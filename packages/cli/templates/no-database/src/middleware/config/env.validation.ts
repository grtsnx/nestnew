export interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  PRODUCTION_URL: string;
  DEVELOPMENT_URL: string;
  PLATFORM_URL: string;
  PLATFORM_NAME: string;
  ENABLE_API_DOCS: string;
  LOG_LEVEL: string;
  CORS_ORIGINS: string;
  REDIS_URL: string;
  EMAIL_PROVIDER: 'test' | 'google' | 'smtp' | 'resend';
  RESEND_API_KEY: string;
  AXIOM_API_KEY: string;
  AXIOM_DATASET: string;
  PLATFORM_SUPPORT: string;
  PLATFORM_LOGO_URL: string;
  COLOR_CODE: string;
  EMAIL_ADDRESS: string;
  EMAIL_PASSWORD: string;
  SMTP_HOST: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_MAX: number;
  PROCESS_ROLE: 'all' | 'api' | 'worker';
  FILES_PROVIDER: 'fs' | 's3' | 'r2';
  FILES_FS_ROOT: string;
  FILES_S3_BUCKET: string;
  FILES_S3_REGION: string;
  FILES_S3_ACCESS_KEY_ID: string;
  FILES_S3_SECRET_ACCESS_KEY: string;
  FILES_S3_ENDPOINT: string;
  FILES_R2_ACCOUNT_ID: string;
  FILES_R2_BUCKET: string;
  FILES_R2_ACCESS_KEY_ID: string;
  FILES_R2_SECRET_ACCESS_KEY: string;
}

const VALID_NODE_ENVS = ['development', 'production', 'test'] as const;
const VALID_PROCESS_ROLES = ['all', 'api', 'worker'] as const;
const VALID_LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
] as const;
const VALID_EMAIL_PROVIDERS = ['test', 'google', 'smtp', 'resend'] as const;
const VALID_FILES_PROVIDERS = ['fs', 's3', 'r2'] as const;

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function isNodeEnv(value: string): value is EnvConfig['NODE_ENV'] {
  return (VALID_NODE_ENVS as readonly string[]).includes(value);
}

function isEmailProvider(value: string): value is EnvConfig['EMAIL_PROVIDER'] {
  return (VALID_EMAIL_PROVIDERS as readonly string[]).includes(value);
}

function isFilesProvider(value: string): value is EnvConfig['FILES_PROVIDER'] {
  return (VALID_FILES_PROVIDERS as readonly string[]).includes(value);
}

function isProcessRole(value: string): value is EnvConfig['PROCESS_ROLE'] {
  return (VALID_PROCESS_ROLES as readonly string[]).includes(value);
}

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const nodeEnv = asString(config.NODE_ENV, 'development');

  if (!isNodeEnv(nodeEnv)) {
    throw new Error(`NODE_ENV must be one of: ${VALID_NODE_ENVS.join(', ')}`);
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid port number between 1 and 65535');
  }

  const productionUrl = asString(config.PRODUCTION_URL).trim();
  const developmentUrl = asString(config.DEVELOPMENT_URL).trim();
  const platformUrl = asString(config.PLATFORM_URL).trim();
  const platformName = asString(
    config.PLATFORM_NAME,
    nodeEnv === 'test' ? 'TestPlatform' : '',
  ).trim();

  const rateLimitTtl = Number(config.RATE_LIMIT_TTL ?? 60000);
  if (!Number.isInteger(rateLimitTtl) || rateLimitTtl < 1000) {
    throw new Error('RATE_LIMIT_TTL must be an integer >= 1000 (milliseconds)');
  }

  const rateLimitMax = Number(config.RATE_LIMIT_MAX ?? 30);
  if (!Number.isInteger(rateLimitMax) || rateLimitMax < 1) {
    throw new Error('RATE_LIMIT_MAX must be a positive integer');
  }

  const processRoleRaw = asString(config.PROCESS_ROLE, 'all').toLowerCase();
  if (!isProcessRole(processRoleRaw)) {
    throw new Error(
      `PROCESS_ROLE must be one of: ${VALID_PROCESS_ROLES.join(', ')}`,
    );
  }

  if (nodeEnv === 'production') {
    if (!productionUrl) {
      throw new Error('PRODUCTION_URL is required when NODE_ENV=production');
    }
    if (!developmentUrl) {
      throw new Error('DEVELOPMENT_URL is required when NODE_ENV=production');
    }
    if (!platformUrl) {
      throw new Error('PLATFORM_URL is required when NODE_ENV=production');
    }
    if (!platformName) {
      throw new Error('PLATFORM_NAME is required when NODE_ENV=production');
    }
  }

  const enableApiDocs =
    nodeEnv === 'production'
      ? asString(config.ENABLE_API_DOCS, 'false')
      : asString(config.ENABLE_API_DOCS, 'true');

  const logLevel = asString(config.LOG_LEVEL, 'info').toLowerCase();
  if (!(VALID_LOG_LEVELS as readonly string[]).includes(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${VALID_LOG_LEVELS.join(', ')}`);
  }

  const emailProviderRaw = asString(
    config.EMAIL_PROVIDER,
    nodeEnv === 'test' ? 'test' : 'test',
  ).toLowerCase();

  if (!isEmailProvider(emailProviderRaw)) {
    throw new Error(
      `EMAIL_PROVIDER must be one of: ${VALID_EMAIL_PROVIDERS.join(', ')}`,
    );
  }

  const platformSupport = asString(
    config.PLATFORM_SUPPORT,
    nodeEnv === 'test' ? 'noreply@test.local' : '',
  ).trim();

  if (!platformSupport) {
    throw new Error('PLATFORM_SUPPORT is required for email configuration');
  }

  const emailAddress = asString(config.EMAIL_ADDRESS).trim();
  const emailPassword = asString(config.EMAIL_PASSWORD).trim();
  const smtpHost = asString(config.SMTP_HOST).trim();
  const smtpUser = asString(config.SMTP_USER).trim();
  const smtpPass = asString(config.SMTP_PASS).trim();
  const redisUrl = asString(config.REDIS_URL).trim();

  if (nodeEnv === 'production') {
    if (!redisUrl) {
      throw new Error('REDIS_URL is required when NODE_ENV=production');
    }
    if (emailProviderRaw === 'test') {
      throw new Error(
        'EMAIL_PROVIDER must not be "test" when NODE_ENV=production',
      );
    }
  }

  if (emailProviderRaw === 'google') {
    if (!emailAddress || !emailPassword) {
      throw new Error(
        'EMAIL_ADDRESS and EMAIL_PASSWORD are required when EMAIL_PROVIDER=google',
      );
    }
  }

  if (emailProviderRaw === 'smtp') {
    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error(
        'SMTP_HOST, SMTP_USER, and SMTP_PASS are required when EMAIL_PROVIDER=smtp',
      );
    }
  }

  const resendApiKey = asString(config.RESEND_API_KEY).trim();

  if (emailProviderRaw === 'resend') {
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    }
  }

  const filesProviderRaw = asString(
    config.FILES_PROVIDER,
    nodeEnv === 'production' ? '' : 'fs',
  ).toLowerCase();

  if (
    nodeEnv === 'production' &&
    (!filesProviderRaw || filesProviderRaw === 'fs')
  ) {
    throw new Error('FILES_PROVIDER must be s3 or r2 when NODE_ENV=production');
  }

  if (!isFilesProvider(filesProviderRaw)) {
    throw new Error(
      `FILES_PROVIDER must be one of: ${VALID_FILES_PROVIDERS.join(', ')}`,
    );
  }

  const filesFsRoot =
    asString(config.FILES_FS_ROOT, '.uploads').trim() || '.uploads';
  const filesS3Bucket = asString(config.FILES_S3_BUCKET).trim();
  const filesS3Region = asString(config.FILES_S3_REGION).trim();
  const filesS3AccessKeyId = asString(config.FILES_S3_ACCESS_KEY_ID).trim();
  const filesS3SecretAccessKey = asString(
    config.FILES_S3_SECRET_ACCESS_KEY,
  ).trim();
  const filesS3Endpoint = asString(config.FILES_S3_ENDPOINT).trim();
  const filesR2AccountId = asString(config.FILES_R2_ACCOUNT_ID).trim();
  const filesR2Bucket = asString(config.FILES_R2_BUCKET).trim();
  const filesR2AccessKeyId = asString(config.FILES_R2_ACCESS_KEY_ID).trim();
  const filesR2SecretAccessKey = asString(
    config.FILES_R2_SECRET_ACCESS_KEY,
  ).trim();

  if (filesProviderRaw === 's3') {
    if (
      !filesS3Bucket ||
      !filesS3Region ||
      !filesS3AccessKeyId ||
      !filesS3SecretAccessKey
    ) {
      throw new Error(
        'FILES_S3_BUCKET, FILES_S3_REGION, FILES_S3_ACCESS_KEY_ID, and FILES_S3_SECRET_ACCESS_KEY are required when FILES_PROVIDER=s3',
      );
    }
  }

  if (filesProviderRaw === 'r2') {
    if (
      !filesR2AccountId ||
      !filesR2Bucket ||
      !filesR2AccessKeyId ||
      !filesR2SecretAccessKey
    ) {
      throw new Error(
        'FILES_R2_ACCOUNT_ID, FILES_R2_BUCKET, FILES_R2_ACCESS_KEY_ID, and FILES_R2_SECRET_ACCESS_KEY are required when FILES_PROVIDER=r2',
      );
    }
  }

  return {
    PORT: port,
    NODE_ENV: nodeEnv,
    PRODUCTION_URL: productionUrl,
    DEVELOPMENT_URL: developmentUrl,
    PLATFORM_URL: platformUrl,
    PLATFORM_NAME: platformName,
    ENABLE_API_DOCS: enableApiDocs,
    LOG_LEVEL: logLevel,
    CORS_ORIGINS: asString(config.CORS_ORIGINS).trim(),
    REDIS_URL: redisUrl,
    EMAIL_PROVIDER: emailProviderRaw,
    PLATFORM_SUPPORT: platformSupport,
    PLATFORM_LOGO_URL: asString(config.PLATFORM_LOGO_URL).trim(),
    COLOR_CODE: asString(config.COLOR_CODE, '#635BFF').trim(),
    EMAIL_ADDRESS: emailAddress,
    EMAIL_PASSWORD: emailPassword,
    SMTP_HOST: smtpHost,
    SMTP_USER: smtpUser,
    SMTP_PASS: smtpPass,
    RESEND_API_KEY: resendApiKey,
    AXIOM_API_KEY: asString(config.AXIOM_API_KEY).trim(),
    AXIOM_DATASET: asString(config.AXIOM_DATASET).trim(),
    RATE_LIMIT_TTL: rateLimitTtl,
    RATE_LIMIT_MAX: rateLimitMax,
    PROCESS_ROLE: processRoleRaw,
    FILES_PROVIDER: filesProviderRaw,
    FILES_FS_ROOT: filesFsRoot,
    FILES_S3_BUCKET: filesS3Bucket,
    FILES_S3_REGION: filesS3Region,
    FILES_S3_ACCESS_KEY_ID: filesS3AccessKeyId,
    FILES_S3_SECRET_ACCESS_KEY: filesS3SecretAccessKey,
    FILES_S3_ENDPOINT: filesS3Endpoint,
    FILES_R2_ACCOUNT_ID: filesR2AccountId,
    FILES_R2_BUCKET: filesR2Bucket,
    FILES_R2_ACCESS_KEY_ID: filesR2AccessKeyId,
    FILES_R2_SECRET_ACCESS_KEY: filesR2SecretAccessKey,
  };
}

function pushIfEmpty(missing: string[], name: string, value: string): void {
  if (!value) {
    missing.push(name);
  }
}

/**
 * Names of env vars this process still needs that are empty.
 * Never include values. Do not list unused provider credentials.
 */
export function listMissingEnv(config: EnvConfig): string[] {
  const missing: string[] = [];

  pushIfEmpty(missing, 'REDIS_URL', config.REDIS_URL);

  if (config.FILES_PROVIDER === 's3') {
    pushIfEmpty(missing, 'FILES_S3_BUCKET', config.FILES_S3_BUCKET);
    pushIfEmpty(missing, 'FILES_S3_REGION', config.FILES_S3_REGION);
    pushIfEmpty(
      missing,
      'FILES_S3_ACCESS_KEY_ID',
      config.FILES_S3_ACCESS_KEY_ID,
    );
    pushIfEmpty(
      missing,
      'FILES_S3_SECRET_ACCESS_KEY',
      config.FILES_S3_SECRET_ACCESS_KEY,
    );
  }

  if (config.FILES_PROVIDER === 'r2') {
    pushIfEmpty(missing, 'FILES_R2_ACCOUNT_ID', config.FILES_R2_ACCOUNT_ID);
    pushIfEmpty(missing, 'FILES_R2_BUCKET', config.FILES_R2_BUCKET);
    pushIfEmpty(
      missing,
      'FILES_R2_ACCESS_KEY_ID',
      config.FILES_R2_ACCESS_KEY_ID,
    );
    pushIfEmpty(
      missing,
      'FILES_R2_SECRET_ACCESS_KEY',
      config.FILES_R2_SECRET_ACCESS_KEY,
    );
  }

  if (config.AXIOM_API_KEY && !config.AXIOM_DATASET) {
    missing.push('AXIOM_DATASET');
  }

  if (config.AXIOM_DATASET && !config.AXIOM_API_KEY) {
    missing.push('AXIOM_API_KEY');
  }

  return missing;
}
