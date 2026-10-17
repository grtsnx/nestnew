import { validateEnv } from 'src/middleware';

import {
  invalidEnvInputs,
  productionEnvConfig,
  testEnvConfig,
  testNodeEnvDefaults,
} from '../../fixtures';

describe('validateEnv', () => {
  it('returns validated config with defaults for development', () => {
    expect(validateEnv({ PLATFORM_SUPPORT: 'noreply@example.com' })).toEqual(
      testEnvConfig,
    );
  });

  it('requires URLs in production', () => {
    expect(() => validateEnv(invalidEnvInputs.productionMissingDevUrl)).toThrow(
      'Missing required env when NODE_ENV=production',
    );
  });

  it('defaults ENABLE_API_DOCS to false in production', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      PRODUCTION_URL: productionEnvConfig.PRODUCTION_URL,
      DEVELOPMENT_URL: productionEnvConfig.DEVELOPMENT_URL,
      PLATFORM_URL: productionEnvConfig.PLATFORM_URL,
      PLATFORM_NAME: productionEnvConfig.PLATFORM_NAME,
      REDIS_URL: productionEnvConfig.REDIS_URL,
      DATABASE_URL: productionEnvConfig.DATABASE_URL,
      EMAIL_PROVIDER: productionEnvConfig.EMAIL_PROVIDER,
      SMTP_HOST: productionEnvConfig.SMTP_HOST,
      SMTP_USER: productionEnvConfig.SMTP_USER,
      SMTP_PASS: productionEnvConfig.SMTP_PASS,
      PLATFORM_SUPPORT: productionEnvConfig.PLATFORM_SUPPORT,
      FILES_PROVIDER: productionEnvConfig.FILES_PROVIDER,
      FILES_S3_BUCKET: productionEnvConfig.FILES_S3_BUCKET,
      FILES_S3_REGION: productionEnvConfig.FILES_S3_REGION,
      FILES_S3_ACCESS_KEY_ID: productionEnvConfig.FILES_S3_ACCESS_KEY_ID,
      FILES_S3_SECRET_ACCESS_KEY:
        productionEnvConfig.FILES_S3_SECRET_ACCESS_KEY,
    });

    expect(config.ENABLE_API_DOCS).toBe('false');
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() => validateEnv(invalidEnvInputs.stagingNodeEnv)).toThrow(
      'NODE_ENV must be one of',
    );
  });

  it('rejects invalid PORT', () => {
    expect(() => validateEnv(invalidEnvInputs.invalidPort)).toThrow(
      'PORT must be a valid port number',
    );
  });

  it('requires all production URLs', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PRODUCTION_URL: productionEnvConfig.PRODUCTION_URL,
        DEVELOPMENT_URL: productionEnvConfig.DEVELOPMENT_URL,
      }),
    ).toThrow('Missing required env when NODE_ENV=production');
  });

  it('requires PLATFORM_NAME in production', () => {
    expect(() =>
      validateEnv(invalidEnvInputs.productionMissingPlatformName),
    ).toThrow(/Missing required env when NODE_ENV=production:.*PLATFORM_NAME/);
  });

  it('requires REDIS_URL in production', () => {
    expect(() => validateEnv(invalidEnvInputs.productionMissingRedis)).toThrow(
      /Missing required env when NODE_ENV=production:.*REDIS_URL/,
    );
  });

  it('requires DATABASE_URL in production', () => {
    expect(() =>
      validateEnv(invalidEnvInputs.productionMissingDatabase),
    ).toThrow(/Missing required env when NODE_ENV=production:.*DATABASE_URL/);
  });

  it('rejects test email provider in production', () => {
    expect(() =>
      validateEnv(invalidEnvInputs.productionTestEmailProvider),
    ).toThrow('EMAIL_PROVIDER must not be "test" when NODE_ENV=production');
  });

  it('accepts explicit ENABLE_API_DOCS in production', () => {
    const config = validateEnv({
      ...productionEnvConfig,
      ENABLE_API_DOCS: 'true',
    });

    expect(config.ENABLE_API_DOCS).toBe('true');
  });

  it('rejects invalid LOG_LEVEL', () => {
    expect(() => validateEnv({ LOG_LEVEL: 'verbose' })).toThrow(
      'LOG_LEVEL must be one of',
    );
  });

  it('trims CORS_ORIGINS', () => {
    expect(
      validateEnv({
        PLATFORM_SUPPORT: 'noreply@example.com',
        CORS_ORIGINS: ' https://a.com , https://b.com ',
      }).CORS_ORIGINS,
    ).toBe('https://a.com , https://b.com');
  });

  it('rejects invalid EMAIL_PROVIDER', () => {
    expect(() => validateEnv(invalidEnvInputs.invalidEmailProvider)).toThrow(
      'EMAIL_PROVIDER must be one of',
    );
  });

  it('requires google credentials when EMAIL_PROVIDER=google', () => {
    expect(() =>
      validateEnv({ EMAIL_PROVIDER: 'google', PLATFORM_SUPPORT: 'a@b.com' }),
    ).toThrow('EMAIL_ADDRESS and EMAIL_PASSWORD are required');
  });

  it('requires smtp credentials when EMAIL_PROVIDER=smtp', () => {
    expect(() =>
      validateEnv({ EMAIL_PROVIDER: 'smtp', PLATFORM_SUPPORT: 'a@b.com' }),
    ).toThrow('SMTP_HOST, SMTP_USER, and SMTP_PASS are required');
  });

  it('defaults email vars for NODE_ENV=test', () => {
    const config = validateEnv({ NODE_ENV: 'test' });

    expect(config.EMAIL_PROVIDER).toBe(testNodeEnvDefaults.EMAIL_PROVIDER);
    expect(config.PLATFORM_NAME).toBe(testNodeEnvDefaults.PLATFORM_NAME);
    expect(config.PLATFORM_SUPPORT).toBe(testNodeEnvDefaults.PLATFORM_SUPPORT);
  });

  it('rejects empty PLATFORM_SUPPORT', () => {
    expect(() => validateEnv(invalidEnvInputs.emptyPlatformSupport)).toThrow(
      'PLATFORM_SUPPORT is required for email configuration',
    );
  });

  it('rejects partial google credentials', () => {
    expect(() => validateEnv(invalidEnvInputs.googleMissingPassword)).toThrow(
      'EMAIL_ADDRESS and EMAIL_PASSWORD are required when EMAIL_PROVIDER=google',
    );
  });

  it('rejects partial smtp credentials', () => {
    expect(() => validateEnv(invalidEnvInputs.smtpMissingHost)).toThrow(
      'SMTP_HOST, SMTP_USER, and SMTP_PASS are required when EMAIL_PROVIDER=smtp',
    );
  });

  it('requires RESEND_API_KEY when EMAIL_PROVIDER=resend', () => {
    expect(() => validateEnv(invalidEnvInputs.resendMissingApiKey)).toThrow(
      'RESEND_API_KEY is required when EMAIL_PROVIDER=resend',
    );
  });

  it('accepts resend when RESEND_API_KEY is set', () => {
    const config = validateEnv({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      PLATFORM_SUPPORT: 'noreply@example.com',
    });

    expect(config.EMAIL_PROVIDER).toBe('resend');
    expect(config.RESEND_API_KEY).toBe('re_test_key');
  });

  it('defaults rate limit values', () => {
    const config = validateEnv({ PLATFORM_SUPPORT: 'noreply@example.com' });

    expect(config.RATE_LIMIT_TTL).toBe(60000);
    expect(config.RATE_LIMIT_MAX).toBe(30);
  });

  it('rejects invalid RATE_LIMIT_TTL', () => {
    expect(() =>
      validateEnv({
        ...invalidEnvInputs.invalidRateLimitTtl,
        PLATFORM_SUPPORT: 'noreply@example.com',
      }),
    ).toThrow('RATE_LIMIT_TTL must be an integer >= 1000');
  });

  it('rejects invalid RATE_LIMIT_MAX', () => {
    expect(() =>
      validateEnv({
        ...invalidEnvInputs.invalidRateLimitMax,
        PLATFORM_SUPPORT: 'noreply@example.com',
      }),
    ).toThrow('RATE_LIMIT_MAX must be a positive integer');
  });

  it('rejects invalid PROCESS_ROLE', () => {
    expect(() =>
      validateEnv({
        ...invalidEnvInputs.invalidProcessRole,
        PLATFORM_SUPPORT: 'noreply@example.com',
      }),
    ).toThrow('PROCESS_ROLE must be one of');
  });

  it('accepts optional Axiom credentials', () => {
    const config = validateEnv({
      PLATFORM_SUPPORT: 'noreply@example.com',
      AXIOM_API_KEY: 'xaat-test',
      AXIOM_DATASET: 'builder-logs',
    });

    expect(config.AXIOM_API_KEY).toBe('xaat-test');
    expect(config.AXIOM_DATASET).toBe('builder-logs');
  });

  it('allows production without Axiom credentials', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      PRODUCTION_URL: productionEnvConfig.PRODUCTION_URL,
      DEVELOPMENT_URL: productionEnvConfig.DEVELOPMENT_URL,
      PLATFORM_URL: productionEnvConfig.PLATFORM_URL,
      PLATFORM_NAME: productionEnvConfig.PLATFORM_NAME,
      REDIS_URL: productionEnvConfig.REDIS_URL,
      DATABASE_URL: productionEnvConfig.DATABASE_URL,
      EMAIL_PROVIDER: productionEnvConfig.EMAIL_PROVIDER,
      SMTP_HOST: productionEnvConfig.SMTP_HOST,
      SMTP_USER: productionEnvConfig.SMTP_USER,
      SMTP_PASS: productionEnvConfig.SMTP_PASS,
      PLATFORM_SUPPORT: productionEnvConfig.PLATFORM_SUPPORT,
      FILES_PROVIDER: productionEnvConfig.FILES_PROVIDER,
      FILES_S3_BUCKET: productionEnvConfig.FILES_S3_BUCKET,
      FILES_S3_REGION: productionEnvConfig.FILES_S3_REGION,
      FILES_S3_ACCESS_KEY_ID: productionEnvConfig.FILES_S3_ACCESS_KEY_ID,
      FILES_S3_SECRET_ACCESS_KEY:
        productionEnvConfig.FILES_S3_SECRET_ACCESS_KEY,
    });

    expect(config.AXIOM_API_KEY).toBe('');
    expect(config.AXIOM_DATASET).toBe('');
  });

  it('defaults FILES_PROVIDER to fs in development', () => {
    expect(
      validateEnv({ PLATFORM_SUPPORT: 'noreply@example.com' }).FILES_PROVIDER,
    ).toBe('fs');
  });

  it('defaults FILES_FS_ROOT to .uploads', () => {
    expect(
      validateEnv({ PLATFORM_SUPPORT: 'noreply@example.com' }).FILES_FS_ROOT,
    ).toBe('.uploads');
  });

  it('rejects invalid FILES_PROVIDER', () => {
    expect(() => validateEnv(invalidEnvInputs.invalidFilesProvider)).toThrow(
      'FILES_PROVIDER must be one of',
    );
  });

  it('rejects fs files provider in production', () => {
    expect(() => validateEnv(invalidEnvInputs.productionFilesFs)).toThrow(
      'FILES_PROVIDER must be s3 or r2 when NODE_ENV=production',
    );
  });

  it('requires S3 credentials when FILES_PROVIDER=s3', () => {
    expect(() => validateEnv(invalidEnvInputs.s3MissingBucket)).toThrow(
      'FILES_S3_BUCKET, FILES_S3_REGION, FILES_S3_ACCESS_KEY_ID, and FILES_S3_SECRET_ACCESS_KEY are required when FILES_PROVIDER=s3',
    );
  });

  it('requires R2 credentials when FILES_PROVIDER=r2', () => {
    expect(() => validateEnv(invalidEnvInputs.r2MissingAccount)).toThrow(
      'FILES_R2_ACCOUNT_ID, FILES_R2_BUCKET, FILES_R2_ACCESS_KEY_ID, and FILES_R2_SECRET_ACCESS_KEY are required when FILES_PROVIDER=r2',
    );
  });

  it('accepts s3 files provider when credentials are set', () => {
    const config = validateEnv({
      PLATFORM_SUPPORT: 'noreply@example.com',
      FILES_PROVIDER: 's3',
      FILES_S3_BUCKET: 'uploads',
      FILES_S3_REGION: 'us-east-1',
      FILES_S3_ACCESS_KEY_ID: 'test',
      FILES_S3_SECRET_ACCESS_KEY: 'test',
      FILES_S3_ENDPOINT: 'http://localhost:9000',
    });

    expect(config.FILES_PROVIDER).toBe('s3');
    expect(config.FILES_S3_ENDPOINT).toBe('http://localhost:9000');
  });

  it('defaults DICEBEAR_STYLE to empty (runtime falls back to loops)', () => {
    expect(
      validateEnv({ PLATFORM_SUPPORT: 'noreply@example.com' }).DICEBEAR_STYLE,
    ).toBe('');
  });

  it('normalizes DICEBEAR_STYLE to lowercase slug', () => {
    const config = validateEnv({
      PLATFORM_SUPPORT: 'noreply@example.com',
      DICEBEAR_STYLE: '  Pixel-Art  ',
    });

    expect(config.DICEBEAR_STYLE).toBe('pixel-art');
  });

  it('rejects invalid DICEBEAR_STYLE', () => {
    expect(() => validateEnv(invalidEnvInputs.invalidDicebearStyle)).toThrow(
      'DICEBEAR_STYLE must be a DiceBear style slug',
    );
  });

  it('defaults TIMEZONE to Africa/Lagos', () => {
    expect(
      validateEnv({ PLATFORM_SUPPORT: 'noreply@example.com' }).TIMEZONE,
    ).toBe('Africa/Lagos');
  });

  it('accepts a valid IANA TIMEZONE', () => {
    expect(
      validateEnv({
        PLATFORM_SUPPORT: 'noreply@example.com',
        TIMEZONE: 'America/New_York',
      }).TIMEZONE,
    ).toBe('America/New_York');
  });

  it('rejects invalid TIMEZONE', () => {
    expect(() => validateEnv(invalidEnvInputs.invalidTimezone)).toThrow(
      'TIMEZONE must be a valid IANA name',
    );
  });
});
