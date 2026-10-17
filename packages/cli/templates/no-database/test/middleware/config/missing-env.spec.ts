import { listMissingEnv } from 'src/middleware';

import { productionEnvConfig, testEnvConfig } from '../../fixtures';

describe('listMissingEnv', () => {
  it('lists REDIS_URL when empty in development', () => {
    expect(listMissingEnv(testEnvConfig)).toEqual(['REDIS_URL']);
  });

  it('does not list unused email or files credentials', () => {
    expect(listMissingEnv(testEnvConfig)).not.toContain('RESEND_API_KEY');
    expect(listMissingEnv(testEnvConfig)).not.toContain('FILES_S3_BUCKET');
    expect(listMissingEnv(testEnvConfig)).not.toContain('FILES_R2_BUCKET');
  });

  it('lists empty S3 credentials when FILES_PROVIDER=s3', () => {
    expect(
      listMissingEnv({
        ...testEnvConfig,
        FILES_PROVIDER: 's3',
      }),
    ).toEqual([
      'REDIS_URL',
      'FILES_S3_BUCKET',
      'FILES_S3_REGION',
      'FILES_S3_ACCESS_KEY_ID',
      'FILES_S3_SECRET_ACCESS_KEY',
    ]);
  });

  it('lists empty R2 credentials when FILES_PROVIDER=r2', () => {
    expect(
      listMissingEnv({
        ...testEnvConfig,
        REDIS_URL: 'redis://localhost:6379',
        FILES_PROVIDER: 'r2',
      }),
    ).toEqual([
      'FILES_R2_ACCOUNT_ID',
      'FILES_R2_BUCKET',
      'FILES_R2_ACCESS_KEY_ID',
      'FILES_R2_SECRET_ACCESS_KEY',
    ]);
  });

  it('lists AXIOM_DATASET when only the API key is set', () => {
    expect(
      listMissingEnv({
        ...testEnvConfig,
        REDIS_URL: 'redis://localhost:6379',
        AXIOM_API_KEY: 'xaat-test',
      }),
    ).toEqual(['AXIOM_DATASET']);
  });

  it('lists AXIOM_API_KEY when only the dataset is set', () => {
    expect(
      listMissingEnv({
        ...testEnvConfig,
        REDIS_URL: 'redis://localhost:6379',
        AXIOM_DATASET: 'builder-logs',
      }),
    ).toEqual(['AXIOM_API_KEY']);
  });

  it('returns empty when production credentials are complete', () => {
    expect(listMissingEnv(productionEnvConfig)).toEqual([]);
  });
});
