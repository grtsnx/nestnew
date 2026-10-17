import { createHash } from 'node:crypto';

import { apiKey } from '@better-auth/api-key';
import { dash, sentinel } from '@better-auth/infra';
import { PrismaPg } from '@prisma/adapter-pg';
import { createId } from '@paralleldrive/cuid2';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import {
  admin as adminPlugin,
  bearer,
  emailOTP,
  haveIBeenPwned,
  lastLoginMethod,
  multiSession,
  openAPI,
  organization,
  twoFactor,
  username,
} from 'better-auth/plugins';
import { autumn } from 'autumn-js/better-auth';
import { createRequestLogger } from 'evlog';

import { PrismaClient } from 'src/lib/prisma/generated/client';

import { normalizePgConnectionString } from '../prisma/pg-connection';
import { assignSignupImage } from '../gravatar/gravatar.service';
import { sendAuthPasswordReset, sendAuthVerificationOtp } from './auth-email';
import {
  grantAndAttachSignupCredits,
  grantSignupCreditsIfEligible,
} from './credits';
import {
  isFreeTrialAbuseEnabled,
  isMultiSessionEnabled,
} from './feature-flags';
import { hashPassword, verifyPassword } from './password';
import { ac, orgAc, orgRoles, roles } from './permissions';
import {
  authSuccessMessage,
  isAuthInfraRelativePath,
  isEmailVerificationOtpSend,
  isHandleResponseBody,
  toHandleResponseBody,
} from 'src/middleware';

const AUTH_INTERNAL_HTTP_PATHS = new Set([
  '/open-api/generate-schema',
  '/reference',
]);

/** Only wrap responses leaving the HTTP handler — not server-side auth.api calls. */
function isPublicAuthHttpResponse(ctx: {
  request?: unknown;
  path?: string;
}): boolean {
  const req = ctx.request;
  if (!req || typeof req !== 'object') {
    return false;
  }
  const candidate = req as { url?: unknown };
  if (typeof candidate.url !== 'string') {
    return false;
  }
  if (ctx.path && AUTH_INTERNAL_HTTP_PATHS.has(ctx.path)) {
    return false;
  }
  if (ctx.path && isAuthInfraRelativePath(ctx.path)) {
    return false;
  }
  return true;
}

function resolveAuthSuccessMessage(baPath: string, returned: unknown): string {
  if (
    baPath === '/email-otp/verify-email' &&
    returned &&
    typeof returned === 'object' &&
    !Array.isArray(returned)
  ) {
    const token = (returned as Record<string, unknown>).token;
    if (typeof token === 'string' && token.length > 0) {
      return authSuccessMessage('/sign-in/email');
    }
  }
  return authSuccessMessage(baPath);
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required for Better Auth');
  }
  return normalizePgConnectionString(url);
}

function isLocalhostOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === '::1'
    );
  } catch {
    return false;
  }
}

/** Public URL Better Auth (and the Infra dashboard) use to reach this server. */
function resolveBetterAuthBaseUrl(): string {
  const port = process.env.PORT?.trim() || '3000';
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  const production = process.env.PRODUCTION_URL?.trim();
  const development = process.env.DEVELOPMENT_URL?.trim();
  const hasInfra = Boolean(process.env.BETTER_AUTH_API_KEY?.trim());

  const publicApiUrl =
    [development, production, explicit].find(
      (url) => url && !isLocalhostOrigin(url),
    ) ?? undefined;

  if (hasInfra && explicit && isLocalhostOrigin(explicit) && publicApiUrl) {
    return publicApiUrl;
  }

  if (explicit && !isLocalhostOrigin(explicit)) {
    return explicit;
  }

  for (const candidate of [development, production]) {
    if (candidate && !isLocalhostOrigin(candidate)) {
      return candidate;
    }
  }

  return explicit || development || production || `http://localhost:${port}`;
}

/** OAuth/API error redirects — frontend page, not the API origin. */
function resolveAuthErrorUrl(): string {
  const explicit = process.env.BETTER_AUTH_ERROR_URL?.trim();
  if (explicit) {
    return explicit;
  }
  const platform = process.env.PLATFORM_URL?.trim();
  if (platform) {
    return `${platform.replace(/\/$/, '')}/auth/error`;
  }
  const port = process.env.PORT?.trim() || '3000';
  return `http://localhost:${port}/auth/error`;
}

const BETTER_AUTH_INFRA_ORIGINS = [
  'https://dash.better-auth.com',
  'https://better-auth.com',
  'https://www.better-auth.com',
  'https://*.better-auth.com',
] as const;

function buildTrustedOrigins(): string[] {
  const fromCors =
    process.env.CORS_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? [];

  const fromEnv =
    process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? [];

  const port = process.env.PORT?.trim() || '3000';
  const candidates = [
    resolveBetterAuthBaseUrl(),
    process.env.PRODUCTION_URL,
    process.env.DEVELOPMENT_URL,
    process.env.PLATFORM_URL,
    `http://localhost:${port}`,
    'http://localhost:3000',
    ...fromCors,
    ...fromEnv,
    ...(process.env.BETTER_AUTH_API_KEY?.trim()
      ? [...BETTER_AUTH_INFRA_ORIGINS]
      : []),
  ];

  return [
    ...new Set(
      candidates
        .map((o) => o?.trim())
        .filter((o): o is string => Boolean(o && o.length > 0)),
    ),
  ];
}

const connectionString = requireDatabaseUrl();
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    keepAlive: true,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  }),
});

const socialProviders: {
  google?: { clientId: string; clientSecret: string };
  github?: { clientId: string; clientSecret: string };
} = {};

function requireOAuthSecret(
  provider: string,
  clientId: string | undefined,
  clientSecret: string | undefined,
): void {
  if (clientId?.trim() && !clientSecret?.trim()) {
    throw new Error(
      `${provider}_CLIENT_SECRET is required when ${provider}_CLIENT_ID is set`,
    );
  }
}

requireOAuthSecret(
  'GOOGLE',
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);
requireOAuthSecret(
  'GITHUB',
  process.env.GITHUB_CLIENT_ID,
  process.env.GITHUB_CLIENT_SECRET,
);

if (process.env.GOOGLE_CLIENT_ID?.trim()) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '',
  };
}

if (process.env.GITHUB_CLIENT_ID?.trim()) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID.trim(),
    clientSecret: process.env.GITHUB_CLIENT_SECRET?.trim() ?? '',
  };
}

const betterAuthApiKey = process.env.BETTER_AUTH_API_KEY?.trim();

/** Stable CSP nonce for Better Auth OpenAPI reference scripts (derived from secret). */
function resolveOpenApiNonce(): string | undefined {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    return undefined;
  }
  return createHash('sha256')
    .update(`openapi-nonce:${secret}`)
    .digest('base64url')
    .slice(0, 22);
}

function buildInfraPlugins(apiKey: string) {
  const platformSupportEmail = process.env.PLATFORM_SUPPORT?.trim();
  const kvUrl = process.env.BETTER_AUTH_KV_URL?.trim();

  return [
    dash({
      apiKey,
      ...(kvUrl ? { kvUrl } : {}),
      activityTracking: {
        enabled: true,
        updateInterval: 300_000,
      },
    }),
    sentinel({
      apiKey,
      ...(kvUrl ? { kvUrl } : {}),
      security: {
        credentialStuffing: {
          enabled: true,
          thresholds: { challenge: 3, block: 5 },
        },
        compromisedPassword: { enabled: true, action: 'block' },
        impossibleTravel: { enabled: true, action: 'challenge' },
        freeTrialAbuse: {
          enabled: isFreeTrialAbuseEnabled(),
          thresholds: { challenge: 2, block: 3 },
          maxAccountsPerVisitor: 3,
          action: 'block',
        },
        velocity: {
          enabled: true,
          maxSignupsPerVisitor: 5,
          action: 'challenge',
        },
        botBlocking: { action: 'challenge' },
        suspiciousIpBlocking: { action: 'block' },
        emailValidation: {
          enabled: true,
          strictness: 'medium',
          action: 'block',
        },
        emailNormalization: { enabled: true },
        staleUsers: {
          enabled: true,
          staleDays: 90,
          action: 'log',
          notifyUser: true,
          notifyAdmin: Boolean(platformSupportEmail),
          ...(platformSupportEmail ? { adminEmail: platformSupportEmail } : {}),
        },
      },
    }),
  ];
}

function authBodyRecord(body: unknown): Record<string, unknown> | null {
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return null;
}

function authBodyEmail(body: unknown): string {
  const email = authBodyRecord(body)?.email;
  return typeof email === 'string' ? email.toLowerCase().trim() : '';
}

function authBodyType(body: unknown): unknown {
  return authBodyRecord(body)?.type;
}

async function rejectIfSignupEmailVerified(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });
  if (user?.emailVerified) {
    throw new APIError('BAD_REQUEST', {
      message: 'Email already verified',
      code: 'EMAIL_ALREADY_VERIFIED',
    });
  }
}

export const auth = betterAuth({
  appName: process.env.PLATFORM_NAME?.trim() || 'App',
  baseURL: resolveBetterAuthBaseUrl(),
  basePath: '/v1/auth',
  trustedOrigins: buildTrustedOrigins(),
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  databaseHooks: {
    user: {
      create: {
        before: (user) => {
          const image = assignSignupImage(user);
          if (!image) {
            return Promise.resolve();
          }
          return Promise.resolve({ data: { ...user, image } });
        },
        after: async (user) => {
          if (user.id) {
            await grantSignupCreditsIfEligible(prisma, user.id);
          }
        },
      },
      update: {
        after: async (user) => {
          if (user.id) {
            await grantSignupCreditsIfEligible(prisma, user.id);
          }
        },
      },
    },
  },
  experimental: {
    joins: true,
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
    },
    database: {
      generateId: () => createId(),
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
    sendResetPassword: async ({ user, url }) => {
      void sendAuthPasswordReset({
        email: user.email,
        url,
        name: user.name,
      });
    },
  },
  emailVerification: {
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    afterEmailVerification: async (user) => {
      if (user.id) {
        await grantSignupCreditsIfEligible(prisma, user.id);
      }
    },
  },
  onAPIError: {
    errorURL: resolveAuthErrorUrl(),
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const email = authBodyEmail(ctx.body);
      if (ctx.path === '/sign-up/email') {
        if (!email) {
          return;
        }
        const existing =
          await ctx.context.internalAdapter.findUserByEmail(email);
        if (existing?.user) {
          throw new APIError('UNPROCESSABLE_ENTITY', {
            message: 'Unable to create account',
            code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
          });
        }
        return;
      }
      if (!isEmailVerificationOtpSend(ctx.path ?? '', authBodyType(ctx.body))) {
        return;
      }
      if (!email) {
        return;
      }
      await rejectIfSignupEmailVerified(email);
    }),
    after: createAuthMiddleware(async (ctx) => {
      let returned = ctx.context.returned;
      if (returned === undefined || returned === null) {
        return;
      }
      if (!isPublicAuthHttpResponse(ctx)) {
        return;
      }
      if (isHandleResponseBody(returned)) {
        return;
      }
      if (isAPIError(returned)) {
        const status = returned.statusCode ?? 400;
        const payload: Record<string, unknown> = { message: returned.message };
        if (returned.body && typeof returned.body === 'object') {
          Object.assign(payload, returned.body as Record<string, unknown>);
        }
        return toHandleResponseBody(status, payload);
      }
      returned = await grantAndAttachSignupCredits(prisma, returned);
      const message = resolveAuthSuccessMessage(ctx.path ?? '', returned);
      return toHandleResponseBody(200, returned, message);
    }),
  },
  socialProviders,
  user: {
    additionalFields: {
      telephone: {
        type: 'string',
        required: false,
        unique: true,
        input: true,
      },
      creditBalance: {
        type: 'number',
        required: false,
        input: false,
        defaultValue: 0,
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
  plugins: [
    openAPI({
      disableDefaultReference: true,
      nonce: resolveOpenApiNonce(),
    }),
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (u) =>
        !['admin', 'support', 'root'].includes(u.toLowerCase()),
    }),
    bearer(),
    emailOTP({
      overrideDefaultEmailVerification: true,
      otpLength: 6,
      expiresIn: 300,
      storeOTP: 'hashed',
      async sendVerificationOTP({ email, otp, type }) {
        if (type === 'email-verification') {
          await rejectIfSignupEmailVerified(email.toLowerCase().trim());
        }
        void sendAuthVerificationOtp({ email, otp, type }).catch((error) => {
          const log = createRequestLogger();
          log.set({
            email: { template: 'verify-otp', toCount: 1 },
            status: 500,
          });
          log.error(error instanceof Error ? error : new Error(String(error)));
          log.emit();
        });
      },
    }),
    twoFactor({
      issuer: process.env.PLATFORM_NAME || 'App',
      otpOptions: {
        storeOTP: 'hashed',
        sendOTP: async () => {},
      },
      allowPasswordless: true,
    }),
    lastLoginMethod({ storeInDatabase: true }),
    haveIBeenPwned({ enabled: process.env.NODE_ENV === 'production' }),
    ...(isMultiSessionEnabled() ? [multiSession()] : []),
    organization({
      teams: { enabled: true },
      ac: orgAc,
      roles: orgRoles,
      async sendInvitationEmail() {},
    }),
    apiKey([
      {
        configId: 'user-keys',
        defaultPrefix: 'user_',
        references: 'user',
        enableSessionForAPIKeys: true,
      },
      {
        configId: 'org-keys',
        defaultPrefix: 'org_',
        references: 'organization',
      },
    ]),
    adminPlugin({
      ac,
      roles: {
        admin: roles.admin,
        support: roles.support,
        developer: roles.developer,
        finance_officer: roles.finance_officer,
        user: roles.user,
      },
    }),
    ...(process.env.AUTUMN_SECRET_KEY?.trim()
      ? [
          autumn({
            secretKey: process.env.AUTUMN_SECRET_KEY.trim(),
            customerScope: 'user_and_organization',
          }),
        ]
      : []),
    ...(betterAuthApiKey ? buildInfraPlugins(betterAuthApiKey) : []),
  ],
});

export type Session = typeof auth.$Infer.Session;
