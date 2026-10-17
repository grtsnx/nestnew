/**
 * Public Auth URL surface (slash segments, no hyphens) → Better Auth canonical paths.
 * BA handlers stay hyphenated; clients and Swagger use the public side only.
 */
export const AUTH_BASE_PATH = '/v1/auth';

/** Better Auth Infra routes — dashboard/server APIs; skip the public response envelope. */
export const AUTH_INFRA_RELATIVE_PREFIXES = ['/dash/', '/events/'] as const;

export function isAuthInfraRelativePath(relativePath: string): boolean {
  const normalized = relativePath.startsWith('/')
    ? relativePath
    : `/${relativePath}`;
  return AUTH_INFRA_RELATIVE_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

export function isAuthInfraHttpPath(pathOnly: string, basePath = AUTH_BASE_PATH): boolean {
  if (!pathOnly.startsWith(basePath)) {
    return false;
  }
  const relative = pathOnly.slice(basePath.length);
  return AUTH_INFRA_RELATIVE_PREFIXES.some((prefix) => relative.startsWith(prefix));
}

/** Password sign-in routes (public alias and Better Auth canonical path). */
export function isAuthSignInHttpPath(
  pathOnly: string,
  basePath = AUTH_BASE_PATH,
): boolean {
  if (!pathOnly.startsWith(basePath)) {
    return false;
  }
  let relative = pathOnly.slice(basePath.length);
  if (!relative.startsWith('/')) {
    relative = `/${relative}`;
  }
  if (relative.length > 1 && relative.endsWith('/')) {
    relative = relative.slice(0, -1);
  }
  return relative === '/sign-in/email' || relative === '/signin/email';
}

/**
 * Docs / client flow order: create account → verify → sign in → password reset.
 * Also drives public alias map key order for rewrites.
 */
export const AUTH_PUBLIC_PATH_ORDER = [
  '/signup/email',
  '/send/verification/email',
  '/verify/email',
  '/signin/email',
  '/signin/social',
  '/forget/password',
  '/reset/password',
] as const;

export type AuthPublicPath = (typeof AUTH_PUBLIC_PATH_ORDER)[number];

/** Public relative path → Better Auth relative path */
export const AUTH_PUBLIC_TO_BA: Readonly<Record<AuthPublicPath, string>> = {
  '/signup/email': '/sign-up/email',
  '/send/verification/email': '/email-otp/send-verification-otp',
  '/verify/email': '/email-otp/verify-email',
  '/signin/email': '/sign-in/email',
  '/signin/social': '/sign-in/social',
  '/forget/password': '/request-password-reset',
  '/reset/password': '/reset-password',
};

/** Better Auth relative path → public relative path (for OpenAPI) */
export const AUTH_BA_TO_PUBLIC: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(AUTH_PUBLIC_TO_BA).map(([pub, ba]) => [ba, pub]),
  );

/** OpenAPI summary (≤6 words) shown in Swagger/Scalar for each public Auth route. */
export const AUTH_OPENAPI_DESCRIPTIONS: Readonly<
  Record<AuthPublicPath, { summary: string; description?: string }>
> = {
  '/signup/email': { summary: 'Create your account' },
  '/send/verification/email': { summary: 'Resend your verification code' },
  '/verify/email': { summary: 'Confirm your email code' },
  '/signin/email': { summary: 'Sign in with email' },
  '/signin/social': { summary: 'Continue with Google or GitHub' },
  '/forget/password': { summary: 'Email a password reset link' },
  '/reset/password': { summary: 'Set a new password' },
};

/** Success envelope message for each Better Auth handler path (hooks use BA paths). */
export const AUTH_SUCCESS_MESSAGES: Readonly<Record<string, string>> = {
  '/sign-up/email': 'Account created',
  '/email-otp/send-verification-otp': 'OTP sent',
  '/email-otp/verify-email': 'Email verified',
  '/sign-in/email': 'Login successful',
  '/sign-in/social': 'Login successful',
  '/request-password-reset': 'Reset link sent',
  '/reset-password': 'Password reset successful',
};

export function authSuccessMessage(baPath: string): string {
  return AUTH_SUCCESS_MESSAGES[baPath] ?? 'Request successful';
}

/** True when this is a resend of the signup verification OTP. */
export function isEmailVerificationOtpSend(
  path: string,
  type: unknown,
): boolean {
  return (
    path === '/email-otp/send-verification-otp' && type === 'email-verification'
  );
}

/** BA paths that must never appear under the Auth Swagger tag. */
export function isAuthOpenApiExcluded(baRelativePath: string): boolean {
  if (baRelativePath === '/ok') return true;
  if (baRelativePath === '/sign-out') return true;
  if (baRelativePath === '/get-session') return true;
  if (baRelativePath === '/callback' || baRelativePath.startsWith('/callback/'))
    return true;
  if (
    baRelativePath === '/two-factor' ||
    baRelativePath.startsWith('/two-factor/')
  )
    return true;
  return false;
}

/**
 * Rewrite a request URL from public Auth alias to Better Auth path.
 * Returns null when no rewrite applies.
 */
export function rewriteAuthPublicUrl(url: string): string | null {
  const qIndex = url.indexOf('?');
  const pathOnly = qIndex >= 0 ? url.slice(0, qIndex) : url;
  const query = qIndex >= 0 ? url.slice(qIndex) : '';

  if (!pathOnly.startsWith(AUTH_BASE_PATH)) {
    return null;
  }

  let relative = pathOnly.slice(AUTH_BASE_PATH.length);
  if (!relative.startsWith('/')) {
    relative = `/${relative}`;
  }
  // Drop trailing slash except root
  if (relative.length > 1 && relative.endsWith('/')) {
    relative = relative.slice(0, -1);
  }

  const baRelative =
    relative in AUTH_PUBLIC_TO_BA
      ? AUTH_PUBLIC_TO_BA[relative as AuthPublicPath]
      : undefined;
  if (!baRelative) {
    return null;
  }

  return `${AUTH_BASE_PATH}${baRelative}${query}`;
}
