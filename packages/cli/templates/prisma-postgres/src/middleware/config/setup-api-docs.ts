import { INestApplication } from '@nestjs/common';
import {
  SwaggerModule,
  DocumentBuilder,
  type OpenAPIObject,
} from '@nestjs/swagger';

import {
  AUTH_BA_TO_PUBLIC,
  AUTH_BASE_PATH,
  AUTH_OPENAPI_DESCRIPTIONS,
  AUTH_PUBLIC_PATH_ORDER,
  AUTH_PUBLIC_TO_BA,
  isAuthOpenApiExcluded,
} from './auth-public-paths';
import { EnvConfig } from './env.validation';
import { isApiDocsEnabled } from './configure-app';
import {
  AUTH_REQUEST_BODY_EXAMPLES,
  AUTH_RESPONSE_EXAMPLES,
  NEST_RESPONSE_EXAMPLES,
} from 'src/dto';
import { isHandleResponseBody } from 'src/middleware';

type AuthOpenApiSchema = {
  paths?: Record<string, Record<string, unknown>>;
};

function resolveAuthOpenApiSchema(raw: unknown): AuthOpenApiSchema {
  if (isHandleResponseBody(raw)) {
    const data = raw.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as AuthOpenApiSchema;
    }
  }
  return (raw ?? {}) as AuthOpenApiSchema;
}

function normalizeBaRelativePath(rawPath: string): string {
  let relative = rawPath.startsWith(AUTH_BASE_PATH)
    ? rawPath.slice(AUTH_BASE_PATH.length)
    : rawPath;
  if (!relative.startsWith('/')) {
    relative = `/${relative}`;
  }
  if (relative.length > 1 && relative.endsWith('/')) {
    relative = relative.slice(0, -1);
  }
  return relative;
}

/**
 * Merge allowlisted Better Auth routes into Nest OpenAPI using public path names.
 * Dynamic import of `auth` avoids a middleware ↔ lib barrel cycle at module load.
 */
async function mergeBetterAuthOpenApi(
  nestDocument: OpenAPIObject,
): Promise<OpenAPIObject> {
  const { auth } = await import('../../lib/betterauth/auth.js');
  const authSchema = resolveAuthOpenApiSchema(
    await auth.api.generateOpenAPISchema(),
  );
  const paths: OpenAPIObject['paths'] = { ...nestDocument.paths };
  const allowedBa = new Set(Object.values(AUTH_PUBLIC_TO_BA));

  // Also accept legacy BA forget-password if present in schema.
  const baAliasExtras: Record<string, string> = {
    '/forget-password': '/forget/password',
  };

  for (const [rawPath, methods] of Object.entries(authSchema.paths ?? {})) {
    if (!methods || typeof methods !== 'object') continue;

    const baRelative = normalizeBaRelativePath(rawPath);
    if (isAuthOpenApiExcluded(baRelative)) continue;

    const publicRelative =
      AUTH_BA_TO_PUBLIC[baRelative] ?? baAliasExtras[baRelative];
    if (!publicRelative) continue;
    if (!allowedBa.has(baRelative) && !(baRelative in baAliasExtras)) {
      continue;
    }

    const fullPublicPath = `${AUTH_BASE_PATH}${publicRelative}`;
    const docs =
      publicRelative in AUTH_OPENAPI_DESCRIPTIONS
        ? AUTH_OPENAPI_DESCRIPTIONS[
            publicRelative as keyof typeof AUTH_OPENAPI_DESCRIPTIONS
          ]
        : undefined;

    const remapped: Record<string, unknown> = {};
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation || typeof operation !== 'object') {
        remapped[method] = operation;
        continue;
      }
      const op = operation as Record<string, unknown>;
      remapped[method] = {
        ...op,
        tags: ['Auth'],
        summary: docs?.summary ?? op.summary,
        // Prefer short human summaries; drop long vendor prose.
        description: docs?.description,
        operationId:
          typeof op.operationId === 'string'
            ? `auth_${op.operationId}`
            : `auth_${method}_${fullPublicPath.replace(/\W+/g, '_')}`,
        security: [],
        ...withAuthExamples(op, publicRelative),
      };
    }

    if (Object.keys(remapped).length === 0) {
      continue;
    }

    paths[fullPublicPath] = {
      ...(paths[fullPublicPath] ?? {}),
      ...remapped,
    };
  }

  return {
    ...nestDocument,
    paths: orderOpenApiPaths(paths),
  };
}

/**
 * Replace BA placeholder examples with ApiSamples on Auth request/response bodies.
 */
function withAuthExamples(
  op: Record<string, unknown>,
  publicRelative: string,
): { requestBody?: unknown; responses?: unknown } {
  const patch: { requestBody?: unknown; responses?: unknown } = {};

  if (op.requestBody && typeof op.requestBody === 'object') {
    patch.requestBody = applyJsonExample(
      structuredClone(op.requestBody),
      AUTH_REQUEST_BODY_EXAMPLES[publicRelative],
    );
  }

  if (op.responses && typeof op.responses === 'object') {
    const responses = structuredClone(op.responses) as Record<
      string,
      Record<string, unknown>
    >;
    const ok = responses['200'];
    if (ok && typeof ok === 'object') {
      responses['200'] = applyJsonExample(
        ok,
        AUTH_RESPONSE_EXAMPLES[publicRelative],
      ) as Record<string, unknown>;
    }
    for (const code of Object.keys(responses)) {
      if (code === '200') continue;
      delete responses[code];
    }
    patch.responses = responses;
  }

  return patch;
}

function inferOpenApiType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

/** Build schema.properties from a sample so Scalar/Swagger can render field rows. */
function exampleToProperties(
  example: Record<string, unknown>,
  priorProperties?: Record<string, unknown>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = { ...(priorProperties ?? {}) };
  for (const [key, value] of Object.entries(example)) {
    const prior = (properties[key] as Record<string, unknown> | undefined) ?? {};
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      properties[key] = {
        ...prior,
        type: 'object',
        properties: exampleToProperties(
          value as Record<string, unknown>,
          prior.properties as Record<string, unknown> | undefined,
        ),
        example: value,
      };
    } else {
      properties[key] = {
        ...prior,
        type: inferOpenApiType(value),
        example: value,
        ...(value === null ? { nullable: true } : {}),
      };
    }
  }
  return properties;
}

function applyJsonExample(
  container: unknown,
  example: Record<string, unknown> | undefined,
): unknown {
  if (!container || typeof container !== 'object' || !example) {
    return container;
  }
  const body = container as {
    description?: string;
    content?: Record<string, Record<string, unknown>>;
  };
  if (!body.content || typeof body.content !== 'object') {
    body.content = {
      'application/json': { schema: { type: 'object' } },
    };
  }
  const json = body.content['application/json'];
  if (!json || typeof json !== 'object') {
    body.content['application/json'] = {
      schema: {
        type: 'object',
        properties: exampleToProperties(example),
        example,
      },
      example,
      examples: { sample: { summary: 'Sample', value: example } },
    };
    return body;
  }

  // Keep BA property metadata where present; layer concrete examples on top.
  const priorSchema =
    json.schema && typeof json.schema === 'object'
      ? (json.schema as Record<string, unknown>)
      : {};
  json.schema = {
    type: 'object',
    ...(Array.isArray(priorSchema.required)
      ? { required: priorSchema.required }
      : {}),
    properties: exampleToProperties(
      example,
      priorSchema.properties as Record<string, unknown> | undefined,
    ),
    example,
  };
  json.example = example;
  json.examples = {
    sample: {
      summary: 'Sample',
      value: example,
    },
  };

  return body;
}

/**
 * Inject handleResponse success examples onto Nest operations (200 only).
 */
function applyNestResponseExamples(doc: OpenAPIObject): OpenAPIObject {
  const paths: OpenAPIObject['paths'] = {};
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item || typeof item !== 'object') {
      paths[path] = item;
      continue;
    }
    const next: Record<string, unknown> = { ...item };
    for (const [method, operation] of Object.entries(item)) {
      if (!operation || typeof operation !== 'object') {
        next[method] = operation;
        continue;
      }
      const key = `${method.toUpperCase()} ${path}`;
      const example = NEST_RESPONSE_EXAMPLES[key];
      if (!example || Number(example.statusCode ?? 200) !== 200) {
        next[method] = operation;
        continue;
      }
      const op = operation as Record<string, unknown>;
      const responses = structuredClone(
        (op.responses as Record<string, unknown> | undefined) ?? {},
      );
      const prior =
        responses['200'] && typeof responses['200'] === 'object'
          ? (responses['200'] as Record<string, unknown>)
          : { description: '' };
      responses['200'] = applyJsonExample(prior, example) as Record<
        string,
        unknown
      >;
      // Success sample only — error shapes come from the global handler.
      for (const code of Object.keys(responses)) {
        if (code === '200') continue;
        delete responses[code];
      }
      next[method] = { ...op, responses };
    }
    paths[path] = next;
  }
  return { ...doc, paths };
}

/** Keep Nest routes, then Auth routes in signup → verify → sign-in → password order. */
function orderOpenApiPaths(
  paths: OpenAPIObject['paths'],
): OpenAPIObject['paths'] {
  const entries = Object.entries(paths ?? {});
  const authFullOrder = AUTH_PUBLIC_PATH_ORDER.map(
    (relative) => `${AUTH_BASE_PATH}${relative}`,
  );
  const authSet = new Set(authFullOrder);
  const nestEntries = entries.filter(([path]) => !authSet.has(path));
  const authEntries = authFullOrder
    .filter((path) => path in (paths ?? {}))
    .map((path) => [path, paths![path]!] as const);
  const leftoverAuth = entries.filter(
    ([path]) => path.startsWith(`${AUTH_BASE_PATH}/`) && !authSet.has(path),
  );

  return Object.fromEntries([
    ...nestEntries,
    ...authEntries,
    ...leftoverAuth,
  ]) as OpenAPIObject['paths'];
}

const VENDOR_NAME_RE =
  /\b(better[\s-]?auth|nestjs|prisma|stripe|autumn|bullmq|redis)\b/gi;

function scrubOpenApiVendorNames(doc: OpenAPIObject): OpenAPIObject {
  const paths: OpenAPIObject['paths'] = {};
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item || typeof item !== 'object') {
      paths[path] = item;
      continue;
    }
    const next: Record<string, unknown> = { ...item };
    for (const [method, operation] of Object.entries(item)) {
      if (!operation || typeof operation !== 'object') {
        next[method] = operation;
        continue;
      }
      const op = operation as Record<string, unknown>;
      const summary =
        typeof op.summary === 'string'
          ? op.summary.replace(VENDOR_NAME_RE, '').replace(/\s+/g, ' ').trim()
          : op.summary;
      const description =
        typeof op.description === 'string'
          ? op.description
              .replace(VENDOR_NAME_RE, '')
              .replace(/\s+/g, ' ')
              .trim()
          : undefined;
      const secured =
        Array.isArray(op.security) ||
        path.startsWith('/v1/user') ||
        path.startsWith('/v1/billing') ||
        path.startsWith('/v1/admin') ||
        path.startsWith('/v1/organisation') ||
        path.startsWith('/v1/member') ||
        path.startsWith('/v1/team');
      const isAnonymousAuth =
        path.includes('/signup/') ||
        path.includes('/signin/') ||
        path.includes('/forget/') ||
        path.includes('/reset/') ||
        path.includes('/verify/') ||
        path.includes('/send/') ||
        path.includes('/check/');
      next[method] = {
        ...op,
        summary,
        description: description || undefined,
        ...(secured && !isAnonymousAuth && !op.security
          ? { security: [{ bearer: [] }] }
          : {}),
      };
    }
    paths[path] = next;
  }
  return { ...doc, paths };
}

export async function setupApiDocs(
  app: INestApplication,
  config: EnvConfig,
): Promise<void> {
  if (!isApiDocsEnabled(config)) {
    return;
  }

  const { apiReference } = await import('@scalar/nestjs-api-reference');

  const {
    PORT: port,
    PRODUCTION_URL: productionUrl,
    DEVELOPMENT_URL: developmentUrl,
    PLATFORM_NAME: platform,
  } = config;

  const swaggerOptions = new DocumentBuilder()
    .setTitle(`${platform} API`)
    .setDescription('Browse and try every endpoint')
    .setVersion('1.0.0')
    .addServer(`http://localhost:${port}`, 'Local')
    .addServer(
      developmentUrl.startsWith('http')
        ? developmentUrl
        : developmentUrl
          ? `https://${developmentUrl}`
          : `http://localhost:${port}`,
      'Development',
    )
    .addServer(
      productionUrl.startsWith('http')
        ? productionUrl
        : productionUrl
          ? `https://${productionUrl}`
          : `http://localhost:${port}`,
      'Production',
    )
    .addTag('Server', 'Health and status')
    .addTag('Auth', 'Create account, verify, sign in')
    .addTag('User', 'Profile and security')
    .addTag('Billing', 'Plans and credits')
    .addTag('Organisation', 'Your organisations')
    .addTag('Member', 'People in your org')
    .addTag('Teams', 'Teams in your org')
    .addTag('BackOffice', 'Admin tools')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'apiKey')
    .build();

  const nestDocument = applyNestResponseExamples(
    SwaggerModule.createDocument(app, swaggerOptions),
  );
  const swaggerDocument = scrubOpenApiVendorNames(
    await mergeBetterAuthOpenApi(nestDocument),
  );

  app.use(
    '/v1/api-reference',
    apiReference({
      content: swaggerDocument,
      theme: 'deepSpace',
      hideClientButton: true,
      hideModels: true,
      showSidebar: true,
      showDeveloperTools: 'localhost',
      operationTitleSource: 'summary',
      persistAuth: false,
      telemetry: false,
      layout: 'modern',
      isEditable: false,
      documentDownloadType: 'both',
      hideTestRequestButton: false,
      hideSearch: false,
      showOperationId: false,
      hideDarkModeToggle: false,
      withDefaultFonts: true,
      defaultOpenAllTags: false,
      expandAllModelSections: false,
      expandAllResponses: false,
      orderSchemaPropertiesBy: 'alpha',
      orderRequiredPropertiesFirst: true,
      _integration: 'nestjs',
      default: false,
      slug: 'api-1',
      title: 'API #1',
    }),
  );

  SwaggerModule.setup('v1/docs', app, swaggerDocument, {
    customSiteTitle: `${platform} API`,
    swaggerOptions: {
      persistAuthorization: false,
      explorer: false,
      defaultModelsExpandDepth: -1,
      docExpansion: 'list',
      defaultModelRendering: 'example',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      displayRequestDuration: true,
      jsonEditor: true,
      useUnsafeSource: false,
      deepLinking: true,
    },
    customCss: `
      .swagger-ui .topbar { display: none; }
    `,
  });
}
