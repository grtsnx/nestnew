#!/usr/bin/env node

import {
  cancel,
  intro,
  isCancel,
  log,
  outro,
  password,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildCompose,
  configureEnv,
  copyTemplate,
  parseArgs,
  updatePackageDependencies,
  validateProjectName,
} from './core.js';

const DOCKER_INSTALL_URL = 'https://docs.docker.com/get-started/get-docker/';
const NEON_URL = 'https://console.neon.tech/app/projects';
const VALID_OPTIONS = {
  database: ['docker', 'neon', 'external', 'later'],
  redis: ['docker', 'external', 'skip'],
  email: ['test', 'smtp', 'google', 'resend'],
  files: ['fs', 'r2', 's3'],
};

function printHelp() {
  console.log(`Create a production-ready NestJS API.

Usage:
  bunx create-nest-boilerplate@latest [project-name] [options]

Options:
  --prisma              Prisma + PostgreSQL template
  --no-database         Template without Prisma or PostgreSQL
  --db=<choice>         docker | neon | external | later
  --redis=<choice>      docker | external | skip
  --email=<choice>      test | smtp | google | resend
  --files=<choice>      fs | r2 | s3
  --skip-install        Do not run bun install
  -h, --help            Show this help

Examples:
  bunx create-nest-boilerplate@latest my-api
  bunx create-nest-boilerplate@latest my-api --prisma --db=docker
  bunx create-nest-boilerplate@latest my-api --no-database --redis=skip
`);
}

async function required(result, message = 'Setup cancelled') {
  if (isCancel(result)) {
    cancel(message);
    process.exit(0);
  }
  return result;
}

function validateChoice(name, value) {
  if (value && !VALID_OPTIONS[name].includes(value)) {
    throw new Error(
      `Invalid --${name === 'database' ? 'db' : name} value "${value}". Choose: ${VALID_OPTIONS[name].join(', ')}`,
    );
  }
  return value;
}

async function choose(value, options) {
  if (value) return value;
  return required(await select(options));
}

async function askText(message, { initialValue, secret = false } = {}) {
  const prompt = secret ? password : text;
  return required(
    await prompt({
      message,
      initialValue: secret ? undefined : initialValue,
      validate(value) {
        if (!value?.trim()) return 'A value is required';
      },
    }),
  );
}

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function openUrl(url) {
  const operatingSystem = platform();
  const command =
    operatingSystem === 'darwin'
      ? ['open', [url]]
      : operatingSystem === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];

  try {
    const child = spawn(command[0], command[1], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    log.info(url);
  }
}

async function replaceMissingDocker(choice, serviceName) {
  if (choice !== 'docker' || commandAvailable('docker')) return choice;

  log.warn('Docker is not installed or is not available on PATH.');
  const fallback = await required(
    await select({
      message: `How should ${serviceName} be configured?`,
      options: [
        {
          value: 'install',
          label: 'Open official Docker installation instructions',
        },
        { value: 'external', label: 'Use an external URL' },
        { value: 'skip', label: 'Skip and configure manually' },
      ],
    }),
  );

  if (fallback === 'install') {
    openUrl(DOCKER_INSTALL_URL);
    log.info(`Docker instructions: ${DOCKER_INSTALL_URL}`);
    return 'skip';
  }
  return fallback;
}

async function collectEmailValues(provider) {
  if (provider === 'test') return {};
  const support = await askText('Sender/support email', {
    initialValue: 'noreply@example.com',
  });
  const values = { PLATFORM_SUPPORT: support };

  if (provider === 'resend') {
    values.RESEND_API_KEY = await askText('Resend API key', { secret: true });
  } else if (provider === 'google') {
    values.EMAIL_ADDRESS = await askText('Google email address');
    values.EMAIL_PASSWORD = await askText('Google app password', {
      secret: true,
    });
  } else {
    values.SMTP_HOST = await askText('SMTP host');
    values.SMTP_USER = await askText('SMTP username');
    values.SMTP_PASS = await askText('SMTP password', { secret: true });
  }
  return values;
}

async function collectFileValues(provider) {
  if (provider === 'fs') return {};
  if (provider === 'r2') {
    return {
      FILES_R2_ACCOUNT_ID: await askText('Cloudflare account ID'),
      FILES_R2_BUCKET: await askText('R2 bucket name'),
      FILES_R2_ACCESS_KEY_ID: await askText('R2 access key ID'),
      FILES_R2_SECRET_ACCESS_KEY: await askText('R2 secret access key', {
        secret: true,
      }),
    };
  }
  const endpoint = await required(
    await text({
      message: 'S3-compatible endpoint (leave blank for AWS)',
      placeholder: 'https://s3.example.com',
    }),
  );
  return {
    FILES_S3_BUCKET: await askText('S3 bucket name'),
    FILES_S3_REGION: await askText('S3 region', {
      initialValue: 'us-east-1',
    }),
    FILES_S3_ACCESS_KEY_ID: await askText('S3 access key ID'),
    FILES_S3_SECRET_ACCESS_KEY: await askText('S3 secret access key', {
      secret: true,
    }),
    ...(endpoint.trim() ? { FILES_S3_ENDPOINT: endpoint.trim() } : {}),
  };
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  validateChoice('database', args.database);
  validateChoice('redis', args.redis);
  validateChoice('email', args.email);
  validateChoice('files', args.files);

  intro('Create NestJS Boilerplate');

  const projectName = validateProjectName(
    args.projectName ?? (await askText('Project name', { initialValue: 'my-api' })),
  );
  const template = await choose(args.template, {
    message: 'Choose a boilerplate',
    options: [
      { value: 'prisma-postgres', label: 'Prisma + PostgreSQL' },
      { value: 'no-database', label: 'Without Prisma or PostgreSQL' },
    ],
  });

  let database =
    template === 'prisma-postgres'
      ? await choose(args.database, {
          message: 'Choose PostgreSQL setup',
          options: [
            { value: 'docker', label: 'Docker', hint: 'recommended locally' },
            { value: 'neon', label: 'Neon hosted PostgreSQL' },
            { value: 'external', label: 'Existing DATABASE_URL' },
            { value: 'later', label: 'Configure later' },
          ],
        })
      : 'skip';

  let redis = await choose(args.redis, {
    message: 'Configure optional Redis',
    options: [
      { value: 'docker', label: 'Docker' },
      { value: 'external', label: 'External REDIS_URL' },
      { value: 'skip', label: 'Skip for now' },
    ],
  });

  database = await replaceMissingDocker(database, 'PostgreSQL');
  redis = await replaceMissingDocker(redis, 'Redis');

  const email = await choose(args.email, {
    message: 'Choose an email provider',
    options: [
      { value: 'test', label: 'Test adapter', hint: 'safe local default' },
      { value: 'smtp', label: 'Generic SMTP' },
      { value: 'google', label: 'Gmail SMTP' },
      { value: 'resend', label: 'Resend API' },
    ],
  });
  const files = await choose(args.files, {
    message: 'Choose file storage',
    options: [
      { value: 'fs', label: 'Local filesystem', hint: 'local default' },
      { value: 'r2', label: 'Cloudflare R2' },
      { value: 's3', label: 'Amazon S3 / compatible' },
    ],
  });

  const values = {
    PLATFORM_NAME: projectName,
    EMAIL_PROVIDER: email,
    FILES_PROVIDER: files,
    ...(template === 'prisma-postgres'
      ? { BETTER_AUTH_SECRET: randomBytes(32).toString('base64url') }
      : {}),
    ...(await collectEmailValues(email)),
    ...(await collectFileValues(files)),
  };

  if (database === 'docker') {
    values.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/app?schema=public';
  } else if (database === 'neon' || database === 'external') {
    if (database === 'neon') {
      openUrl(NEON_URL);
      log.info(`Create a Neon database, then copy its connection string: ${NEON_URL}`);
    }
    values.DATABASE_URL =
      process.env.DATABASE_URL ?? (await askText('PostgreSQL DATABASE_URL', { secret: true }));
  }

  if (redis === 'docker') {
    values.REDIS_URL = 'redis://localhost:6379';
  } else if (redis === 'external') {
    values.REDIS_URL =
      process.env.REDIS_URL ?? (await askText('Redis REDIS_URL', { secret: true }));
  }

  const cliDirectory = dirname(fileURLToPath(import.meta.url));
  const templateDirectory = join(cliDirectory, '..', 'templates', template);
  const targetDirectory = resolve(process.cwd(), projectName);
  const progress = spinner();
  progress.start('Copying template');
  await copyTemplate({
    templateDir: templateDirectory,
    targetDir: targetDirectory,
    projectName,
  });
  await configureEnv({
    samplePath: join(targetDirectory, 'env.sample'),
    envPath: join(targetDirectory, '.env'),
    values,
  });

  if (files === 's3') {
    await updatePackageDependencies(join(targetDirectory, 'package.json'), {
      '@aws-sdk/client-s3': '3.1152.0',
      '@aws-sdk/s3-presigned-post': '3.1152.0',
      '@aws-sdk/s3-request-presigner': '3.1152.0',
    });
  }

  const usesDocker = database === 'docker' || redis === 'docker';
  if (usesDocker) {
    await writeFile(
      join(targetDirectory, 'compose.yaml'),
      buildCompose({
        postgres: database === 'docker',
        redis: redis === 'docker',
      }),
    );
  }
  progress.stop('Project files created');

  if (usesDocker) {
    log.step('Starting Docker services');
    run('docker', ['compose', 'up', '-d'], targetDirectory);
  }

  if (args.install) {
    log.step('Installing tested dependencies');
    run(
      'bun',
      files === 's3' ? ['install'] : ['install', '--frozen-lockfile'],
      targetDirectory,
    );
    if (template === 'prisma-postgres') {
      run('bun', ['run', 'prisma:generate'], targetDirectory);
      if (database === 'docker') {
        run('bun', ['run', 'prisma:migrate:deploy'], targetDirectory);
      }
    }
  }

  const next = [`cd ${projectName}`];
  if (!args.install) next.push('bun install');
  if (template === 'prisma-postgres' && database !== 'docker') {
    next.push('bun run prisma:migrate:deploy');
  }
  next.push('bun run start:dev');
  outro(`Created ${projectName}\n\nNext:\n  ${next.join('\n  ')}`);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
