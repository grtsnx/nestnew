import { afterEach, describe, expect, test } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildCompose,
  configureEnv,
  copyTemplate,
  parseArgs,
  updatePackageDependencies,
  validateProjectName,
} from '../src/core.js';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('parseArgs', () => {
  test('parses direct non-interactive selections', () => {
    expect(
      parseArgs([
        'orders-api',
        '--prisma',
        '--db=docker',
        '--redis=external',
        '--email=resend',
        '--files=r2',
        '--skip-install',
      ]),
    ).toEqual({
      projectName: 'orders-api',
      template: 'prisma-postgres',
      database: 'docker',
      redis: 'external',
      email: 'resend',
      files: 'r2',
      install: false,
      help: false,
    });
  });

  test('rejects conflicting template flags', () => {
    expect(() => parseArgs(['api', '--prisma', '--no-database'])).toThrow(
      'Choose either --prisma or --no-database',
    );
  });
});

describe('validateProjectName', () => {
  test('accepts npm-safe directory names', () => {
    expect(validateProjectName('orders-api')).toBe('orders-api');
  });

  test('rejects traversal and nested paths', () => {
    expect(() => validateProjectName('../orders')).toThrow('project name');
    expect(() => validateProjectName('team/orders')).toThrow('project name');
  });
});

describe('configureEnv', () => {
  test('copies the sample, applies selected providers, and removes redundant telemetry', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nest-cli-env-'));
    temporaryDirectories.push(directory);
    const samplePath = join(directory, 'env.sample');
    const envPath = join(directory, '.env');

    await writeFile(
      samplePath,
      [
        'EMAIL_PROVIDER=test',
        'FILES_PROVIDER=fs',
        '# REDIS_URL=redis://localhost:6379',
        '# DATABASE_URL=postgresql://localhost:5432/app',
        '# RESEND_API_KEY=',
        '# FILES_R2_ACCOUNT_ID=',
        '# EMAIL_SDK_TELEMETRY=0',
        '',
      ].join('\n'),
    );

    await configureEnv({
      samplePath,
      envPath,
      values: {
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_secret',
        FILES_PROVIDER: 'r2',
        FILES_R2_ACCOUNT_ID: 'account-id',
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/app',
      },
    });

    const env = await readFile(envPath, 'utf8');
    expect(env).toContain('EMAIL_PROVIDER=resend');
    expect(env).toContain('RESEND_API_KEY=re_secret');
    expect(env).toContain('FILES_PROVIDER=r2');
    expect(env).toContain('FILES_R2_ACCOUNT_ID=account-id');
    expect(env).toContain('REDIS_URL=redis://localhost:6379');
    expect(env).toContain(
      'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app',
    );
    expect(env).not.toContain('EMAIL_SDK_TELEMETRY');

    const sample = await readFile(samplePath, 'utf8');
    expect(sample).not.toContain('re_secret');
  });
});

describe('buildCompose', () => {
  test('adds PostgreSQL and Redis with persistent health-checked services', () => {
    const compose = buildCompose({ postgres: true, redis: true });

    expect(compose).toContain('postgres:18.6-alpine');
    expect(compose).toContain('redis:8.10.2-alpine');
    expect(compose).toContain('pg_isready');
    expect(compose).toContain('redis-cli');
    expect(compose).toContain('postgres_data:/var/lib/postgresql\n');
    expect(compose).not.toContain('postgres_data:/var/lib/postgresql/data');
    expect(compose).toContain('postgres_data:');
    expect(compose).toContain('redis_data:');
  });

  test('only emits requested services', () => {
    const compose = buildCompose({ postgres: false, redis: true });

    expect(compose).not.toContain('postgres:18.6-alpine');
    expect(compose).toContain('redis:8.10.2-alpine');
  });
});

describe('copyTemplate', () => {
  test('copies a clean template and rewrites its package name', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nest-cli-copy-'));
    temporaryDirectories.push(directory);
    const source = join(directory, 'source');
    const target = join(directory, 'orders-api');

    await mkdir(join(source, 'src'), { recursive: true });
    await mkdir(join(source, '.git'), { recursive: true });
    await mkdir(join(source, 'dist'), { recursive: true });
    await writeFile(
      join(source, 'package.json'),
      JSON.stringify({ name: 'builderbackend', private: true }),
    );
    await writeFile(join(source, 'src', 'main.ts'), 'export {};\n');
    await writeFile(join(source, 'gitignore'), '.env\nnode_modules/\n');
    await writeFile(join(source, '.git', 'config'), 'secret history');
    await writeFile(join(source, 'dist', 'main.js'), 'generated');
    await writeFile(join(source, '.env'), 'SECRET=do-not-copy\n');

    await copyTemplate({
      templateDir: source,
      targetDir: target,
      projectName: 'orders-api',
    });

    const packageJson = JSON.parse(
      await readFile(join(target, 'package.json'), 'utf8'),
    );
    expect(packageJson.name).toBe('orders-api');
    expect(await readFile(join(target, 'src', 'main.ts'), 'utf8')).toBe(
      'export {};\n',
    );
    expect(await readFile(join(target, '.gitignore'), 'utf8')).toContain('.env');
    await expect(stat(join(target, 'gitignore'))).rejects.toThrow();
    await expect(stat(join(target, '.git'))).rejects.toThrow();
    await expect(stat(join(target, 'dist'))).rejects.toThrow();
    await expect(stat(join(target, '.env'))).rejects.toThrow();
  });

  test('refuses to copy over an existing directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nest-cli-existing-'));
    temporaryDirectories.push(directory);
    const source = join(directory, 'source');
    const target = join(directory, 'existing');
    await mkdir(source);
    await mkdir(target);

    await expect(
      copyTemplate({
        templateDir: source,
        targetDir: target,
        projectName: 'existing',
      }),
    ).rejects.toThrow('already exists');
  });
});

describe('updatePackageDependencies', () => {
  test('adds pinned optional adapter dependencies', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nest-cli-package-'));
    temporaryDirectories.push(directory);
    const packagePath = join(directory, 'package.json');
    await writeFile(
      packagePath,
      `${JSON.stringify({ dependencies: { 'files-sdk': '^3.1.1' } })}\n`,
    );

    await updatePackageDependencies(packagePath, {
      '@aws-sdk/client-s3': '3.1152.0',
      '@aws-sdk/s3-presigned-post': '3.1152.0',
      '@aws-sdk/s3-request-presigner': '3.1152.0',
    });

    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    expect(packageJson.dependencies).toEqual({
      '@aws-sdk/client-s3': '3.1152.0',
      '@aws-sdk/s3-presigned-post': '3.1152.0',
      '@aws-sdk/s3-request-presigner': '3.1152.0',
      'files-sdk': '^3.1.1',
    });
  });
});
