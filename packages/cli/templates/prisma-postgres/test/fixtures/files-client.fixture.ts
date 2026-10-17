/** FILES_PROVIDER config snapshots for files-client.factory specs. */
export const filesClientConfigFixtures = {
  fs: {
    FILES_PROVIDER: 'fs',
    FILES_FS_ROOT: '.uploads',
  },
  s3: {
    FILES_PROVIDER: 's3',
    FILES_S3_BUCKET: 'uploads',
    FILES_S3_REGION: 'us-east-1',
    FILES_S3_ACCESS_KEY_ID: 'test-key',
    FILES_S3_SECRET_ACCESS_KEY: 'test-secret',
  },
  s3WithEndpoint: {
    FILES_PROVIDER: 's3',
    FILES_S3_BUCKET: 'uploads',
    FILES_S3_REGION: 'us-east-1',
    FILES_S3_ACCESS_KEY_ID: 'test-key',
    FILES_S3_SECRET_ACCESS_KEY: 'test-secret',
    FILES_S3_ENDPOINT: 'http://localhost:9000',
  },
  r2: {
    FILES_PROVIDER: 'r2',
    FILES_R2_ACCOUNT_ID: 'acct',
    FILES_R2_BUCKET: 'uploads',
    FILES_R2_ACCESS_KEY_ID: 'r2-key',
    FILES_R2_SECRET_ACCESS_KEY: 'r2-secret',
  },
  invalidProvider: { FILES_PROVIDER: 'gcs' },
} as const;
