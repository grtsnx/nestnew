import * as express from 'express';
import helmet from 'helmet';

import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvConfig } from './env.validation';

function parseCorsOrigins(corsOrigins: string): (string | RegExp)[] {
  if (!corsOrigins) {
    return [];
  }

  return corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildCorsOrigins(config: EnvConfig): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [
    config.PRODUCTION_URL,
    config.DEVELOPMENT_URL,
    config.PLATFORM_URL,
    `http://localhost:${config.PORT}`,
    ...parseCorsOrigins(config.CORS_ORIGINS),
  ];

  return origins.filter((origin): origin is string | RegExp =>
    typeof origin === 'string' ? origin.length > 0 : true,
  );
}

export function getEnvConfig(configService: ConfigService): EnvConfig {
  return {
    PORT: configService.get<number>('PORT') ?? 3000,
    NODE_ENV: (configService.get<string>('NODE_ENV') ??
      'development') as EnvConfig['NODE_ENV'],
    PRODUCTION_URL: configService.get<string>('PRODUCTION_URL') ?? '',
    DEVELOPMENT_URL: configService.get<string>('DEVELOPMENT_URL') ?? '',
    PLATFORM_URL: configService.get<string>('PLATFORM_URL') ?? '',
    PLATFORM_NAME: configService.get<string>('PLATFORM_NAME') ?? '',
    ENABLE_API_DOCS: configService.get<string>('ENABLE_API_DOCS') ?? 'true',
    LOG_LEVEL: configService.get<string>('LOG_LEVEL') ?? 'info',
    CORS_ORIGINS: configService.get<string>('CORS_ORIGINS') ?? '',
    REDIS_URL: configService.get<string>('REDIS_URL') ?? '',
    EMAIL_PROVIDER:
      (configService.get<string>(
        'EMAIL_PROVIDER',
      ) as EnvConfig['EMAIL_PROVIDER']) ?? 'test',
    PLATFORM_SUPPORT: configService.get<string>('PLATFORM_SUPPORT') ?? '',
    PLATFORM_LOGO_URL: configService.get<string>('PLATFORM_LOGO_URL') ?? '',
    COLOR_CODE: configService.get<string>('COLOR_CODE') ?? '#635BFF',
    EMAIL_ADDRESS: configService.get<string>('EMAIL_ADDRESS') ?? '',
    EMAIL_PASSWORD: configService.get<string>('EMAIL_PASSWORD') ?? '',
    SMTP_HOST: configService.get<string>('SMTP_HOST') ?? '',
    SMTP_USER: configService.get<string>('SMTP_USER') ?? '',
    SMTP_PASS: configService.get<string>('SMTP_PASS') ?? '',
    RESEND_API_KEY: configService.get<string>('RESEND_API_KEY') ?? '',
    AXIOM_API_KEY: configService.get<string>('AXIOM_API_KEY') ?? '',
    AXIOM_DATASET: configService.get<string>('AXIOM_DATASET') ?? '',
    RATE_LIMIT_TTL: configService.get<number>('RATE_LIMIT_TTL') ?? 60000,
    RATE_LIMIT_MAX: configService.get<number>('RATE_LIMIT_MAX') ?? 30,
    PROCESS_ROLE:
      (configService.get<string>('PROCESS_ROLE') as EnvConfig['PROCESS_ROLE']) ??
      'all',
    FILES_PROVIDER:
      (configService.get<string>(
        'FILES_PROVIDER',
      ) as EnvConfig['FILES_PROVIDER']) ?? 'fs',
    FILES_FS_ROOT: configService.get<string>('FILES_FS_ROOT') ?? '.uploads',
    FILES_S3_BUCKET: configService.get<string>('FILES_S3_BUCKET') ?? '',
    FILES_S3_REGION: configService.get<string>('FILES_S3_REGION') ?? '',
    FILES_S3_ACCESS_KEY_ID:
      configService.get<string>('FILES_S3_ACCESS_KEY_ID') ?? '',
    FILES_S3_SECRET_ACCESS_KEY:
      configService.get<string>('FILES_S3_SECRET_ACCESS_KEY') ?? '',
    FILES_S3_ENDPOINT: configService.get<string>('FILES_S3_ENDPOINT') ?? '',
    FILES_R2_ACCOUNT_ID: configService.get<string>('FILES_R2_ACCOUNT_ID') ?? '',
    FILES_R2_BUCKET: configService.get<string>('FILES_R2_BUCKET') ?? '',
    FILES_R2_ACCESS_KEY_ID:
      configService.get<string>('FILES_R2_ACCESS_KEY_ID') ?? '',
    FILES_R2_SECRET_ACCESS_KEY:
      configService.get<string>('FILES_R2_SECRET_ACCESS_KEY') ?? '',
  };
}

export function configureApp(app: INestApplication): EnvConfig {
  const configService = app.get(ConfigService);
  const config = getEnvConfig(configService);

  const {
    PORT: port,
    PRODUCTION_URL: productionUrl,
    DEVELOPMENT_URL: developmentUrl,
    PLATFORM_URL: platformUrl,
  } = config;

  app.enableShutdownHooks();

  const expressApp = app.getHttpAdapter().getInstance() as express.Application;
  expressApp.disable('x-powered-by');
  expressApp.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.jsdelivr.net',
            'https://unpkg.com',
          ],
          'style-src': [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.jsdelivr.net',
            'https://unpkg.com',
          ],
          'img-src': [
            "'self'",
            'data:',
            'https://cdn.jsdelivr.net',
            'https://unpkg.com',
          ],
          'font-src': [
            "'self'",
            'https://cdn.jsdelivr.net',
            'https://unpkg.com',
          ],
          'connect-src': [
            "'self'",
            productionUrl,
            developmentUrl,
            platformUrl,
            `http://localhost:${port}`,
          ].filter((origin) => origin.length > 0),
        },
      },
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.enableCors({
    origin: buildCorsOrigins(config),
    credentials: true,
    optionsSuccessStatus: 200,
    methods: 'GET,PATCH,POST,PUT,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Visitor-Id',
      'X-Request-Id',
      'X-Device-Id',
      'X-Device-Name',
    ],
  });

  app.use(
    express.json({
      limit: '10kb',
      verify: (req: express.Request & { rawBody?: Buffer }, _res, buffer) => {
        req.rawBody = Buffer.from(buffer);
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      stopAtFirstError: true,
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  return config;
}

export function isApiDocsEnabled(config: EnvConfig): boolean {
  return config.NODE_ENV !== 'production' || config.ENABLE_API_DOCS === 'true';
}
