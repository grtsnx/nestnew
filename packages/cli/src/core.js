import { access, cp, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const VALUE_FLAGS = new Set(['db', 'redis', 'email', 'files']);

export function parseArgs(argv) {
  const parsed = {
    projectName: undefined,
    template: undefined,
    database: undefined,
    redis: undefined,
    email: undefined,
    files: undefined,
    install: true,
    help: false,
  };
  let prisma = false;
  let noDatabase = false;

  for (const argument of argv) {
    if (argument === '--prisma') {
      prisma = true;
      continue;
    }
    if (argument === '--no-database') {
      noDatabase = true;
      continue;
    }
    if (argument === '--skip-install') {
      parsed.install = false;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }
    if (argument.startsWith('--')) {
      const [flag, value] = argument.slice(2).split('=', 2);
      if (!VALUE_FLAGS.has(flag) || value === undefined || value === '') {
        throw new Error(`Unknown or incomplete option: ${argument}`);
      }
      const property = flag === 'db' ? 'database' : flag;
      parsed[property] = value;
      continue;
    }
    if (parsed.projectName) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    parsed.projectName = argument;
  }

  if (prisma && noDatabase) {
    throw new Error('Choose either --prisma or --no-database, not both');
  }
  if (prisma) parsed.template = 'prisma-postgres';
  if (noDatabase) parsed.template = 'no-database';

  return parsed;
}

export function validateProjectName(value) {
  const name = value?.trim();
  if (!name || !/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    throw new Error(
      'Use a project name containing only letters, numbers, dots, dashes, or underscores',
    );
  }
  return name;
}

function formatEnvValue(value) {
  const stringValue = String(value);
  return /^[^\s#"']*$/.test(stringValue)
    ? stringValue
    : JSON.stringify(stringValue);
}

function setEnvValue(content, key, value) {
  const replacement = `${key}=${formatEnvValue(value)}`;
  const linePattern = new RegExp(`^(?:#\\s*)?${key}=.*$`, 'm');
  if (linePattern.test(content)) {
    return content.replace(linePattern, replacement);
  }
  return `${content.replace(/\s*$/, '\n')}${replacement}\n`;
}

export async function configureEnv({ samplePath, envPath, values }) {
  const sample = await readFile(samplePath, 'utf8');
  let env = sample
    .split('\n')
    .filter((line) => !/^#?\s*EMAIL_SDK_TELEMETRY=/.test(line))
    .join('\n');

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      env = setEnvValue(env, key, value);
    }
  }

  await writeFile(envPath, env.endsWith('\n') ? env : `${env}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
}

const EXCLUDED_TEMPLATE_ENTRIES = new Set([
  '.DS_Store',
  '.env',
  '.evlog',
  '.git',
  'coverage',
  'dist',
  'node_modules',
]);

export async function copyTemplate({ templateDir, targetDir, projectName }) {
  try {
    await access(targetDir);
    throw new Error(`Target directory already exists: ${targetDir}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  await cp(templateDir, targetDir, {
    recursive: true,
    filter(source) {
      return !EXCLUDED_TEMPLATE_ENTRIES.has(basename(source));
    },
  });

  try {
    await rename(join(targetDir, 'gitignore'), join(targetDir, '.gitignore'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const packagePath = join(targetDir, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  packageJson.name = projectName;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

export async function updatePackageDependencies(packagePath, additions) {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  packageJson.dependencies = Object.fromEntries(
    Object.entries({ ...(packageJson.dependencies ?? {}), ...additions }).sort(
      ([left], [right]) => left.localeCompare(right),
    ),
  );
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

export function buildCompose({ postgres, redis }) {
  const services = [];
  const volumes = [];

  if (postgres) {
    services.push(`  postgres:
    image: postgres:18.6-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app"]
      interval: 5s
      timeout: 5s
      retries: 10`);
    volumes.push('  postgres_data:');
  }

  if (redis) {
    services.push(`  redis:
    image: redis:8.10.2-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10`);
    volumes.push('  redis_data:');
  }

  const volumeSection = volumes.length
    ? `\n\nvolumes:\n${volumes.join('\n')}\n`
    : '\n';
  return `services:\n${services.join('\n\n')}${volumeSection}`;
}
