import type { EnvConfig } from 'src/middleware';

export const testEnvConfig: EnvConfig = {
  PORT: 3000,
  NODE_ENV: 'development',
  PRODUCTION_URL: '',
  DEVELOPMENT_URL: '',
  PLATFORM_URL: '',
  PLATFORM_NAME: '',
  ENABLE_API_DOCS: 'true',
  LOG_LEVEL: 'info',
  CORS_ORIGINS: '',
  REDIS_URL: '',
  DATABASE_URL: '',
  EMAIL_PROVIDER: 'test',
  PLATFORM_SUPPORT: 'noreply@example.com',
  PLATFORM_LOGO_URL: '',
  COLOR_CODE: '#635BFF',
  TIMEZONE: 'Africa/Lagos',
  EMAIL_ADDRESS: '',
  EMAIL_PASSWORD: '',
  SMTP_HOST: '',
  SMTP_USER: '',
  SMTP_PASS: '',
  RESEND_API_KEY: '',
  AXIOM_API_KEY: '',
  AXIOM_DATASET: '',
  DICEBEAR_STYLE: '',
  RATE_LIMIT_TTL: 60000,
  RATE_LIMIT_MAX: 30,
  PROCESS_ROLE: 'all',
  FILES_PROVIDER: 'fs',
  FILES_FS_ROOT: '.uploads',
  FILES_S3_BUCKET: '',
  FILES_S3_REGION: '',
  FILES_S3_ACCESS_KEY_ID: '',
  FILES_S3_SECRET_ACCESS_KEY: '',
  FILES_S3_ENDPOINT: '',
  FILES_R2_ACCOUNT_ID: '',
  FILES_R2_BUCKET: '',
  FILES_R2_ACCESS_KEY_ID: '',
  FILES_R2_SECRET_ACCESS_KEY: '',
};

export const productionEnvConfig: EnvConfig = {
  ...testEnvConfig,
  NODE_ENV: 'production',
  PRODUCTION_URL: 'https://api.example.com',
  DEVELOPMENT_URL: 'https://dev.example.com',
  PLATFORM_URL: 'https://app.example.com',
  PLATFORM_NAME: 'TestPlatform',
  ENABLE_API_DOCS: 'false',
  REDIS_URL: 'redis://localhost:6379',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/dbname',
  EMAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  FILES_PROVIDER: 's3',
  FILES_S3_BUCKET: 'uploads',
  FILES_S3_REGION: 'us-east-1',
  FILES_S3_ACCESS_KEY_ID: 'test',
  FILES_S3_SECRET_ACCESS_KEY: 'test',
};

/** Expected defaults when NODE_ENV=test. */
export const testNodeEnvDefaults = {
  EMAIL_PROVIDER: 'test',
  PLATFORM_NAME: 'TestPlatform',
  PLATFORM_SUPPORT: 'noreply@test.local',
} as const;

const productionBase = {
  NODE_ENV: 'production' as const,
  PRODUCTION_URL: productionEnvConfig.PRODUCTION_URL,
  DEVELOPMENT_URL: productionEnvConfig.DEVELOPMENT_URL,
  PLATFORM_URL: productionEnvConfig.PLATFORM_URL,
  PLATFORM_NAME: productionEnvConfig.PLATFORM_NAME,
  REDIS_URL: productionEnvConfig.REDIS_URL,
  DATABASE_URL: productionEnvConfig.DATABASE_URL,
  EMAIL_PROVIDER: 'smtp' as const,
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  PLATFORM_SUPPORT: 'noreply@example.com',
  FILES_PROVIDER: 's3' as const,
  FILES_S3_BUCKET: 'uploads',
  FILES_S3_REGION: 'us-east-1',
  FILES_S3_ACCESS_KEY_ID: 'test',
  FILES_S3_SECRET_ACCESS_KEY: 'test',
};

/** Invalid env inputs for rejection specs. */
export const invalidEnvInputs = {
  stagingNodeEnv: { NODE_ENV: 'staging' },
  invalidPort: { PORT: 'not-a-port' },
  emptyPlatformSupport: { PLATFORM_SUPPORT: '   ' },
  invalidEmailProvider: { EMAIL_PROVIDER: 'mailgun' },
  googleMissingPassword: {
    EMAIL_PROVIDER: 'google',
    EMAIL_ADDRESS: 'user@gmail.com',
    PLATFORM_SUPPORT: 'noreply@example.com',
  },
  smtpMissingHost: {
    EMAIL_PROVIDER: 'smtp',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    PLATFORM_SUPPORT: 'noreply@example.com',
  },
  productionMissingDevUrl: {
    NODE_ENV: 'production',
    PRODUCTION_URL: 'https://api.example.com',
  },
  productionMissingPlatformName: {
    ...productionBase,
    PLATFORM_NAME: '',
  },
  productionMissingRedis: {
    ...productionBase,
    REDIS_URL: '',
  },
  productionMissingDatabase: {
    ...productionBase,
    DATABASE_URL: '',
  },
  productionTestEmailProvider: {
    ...productionBase,
    EMAIL_PROVIDER: 'test',
  },
  invalidRateLimitTtl: { RATE_LIMIT_TTL: '500' },
  invalidRateLimitMax: { RATE_LIMIT_MAX: '0' },
  invalidProcessRole: { PROCESS_ROLE: 'sidecar' },
  resendMissingApiKey: {
    EMAIL_PROVIDER: 'resend',
    PLATFORM_SUPPORT: 'noreply@example.com',
  },
  productionFilesFs: {
    ...productionBase,
    FILES_PROVIDER: 'fs',
  },
  s3MissingBucket: {
    PLATFORM_SUPPORT: 'noreply@example.com',
    FILES_PROVIDER: 's3',
  },
  r2MissingAccount: {
    PLATFORM_SUPPORT: 'noreply@example.com',
    FILES_PROVIDER: 'r2',
  },
  invalidFilesProvider: {
    PLATFORM_SUPPORT: 'noreply@example.com',
    FILES_PROVIDER: 'gcs',
  },
  invalidDicebearStyle: {
    PLATFORM_SUPPORT: 'noreply@example.com',
    DICEBEAR_STYLE: 'Loops Animated!',
  },
  invalidTimezone: {
    PLATFORM_SUPPORT: 'noreply@example.com',
    TIMEZONE: 'Not/AZone',
  },
} as const;
