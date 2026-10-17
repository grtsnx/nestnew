import 'dotenv/config';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { initLogger } from 'evlog';

import { AppModule } from 'src/app';
import {
  createEvlogInitOptions,
  emitServerFault,
  evlogInputFromEnv,
  getEnvConfig,
  listMissingEnv,
  logStartup,
} from 'src/middleware';

process.env.PROCESS_ROLE ??= 'worker';

const evlogInit = createEvlogInitOptions(
  evlogInputFromEnv(process.env),
  'worker',
);
initLogger(evlogInit);

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    // Same as main: avoid Nest logger duplicating emitServerFault lines.
    logger: false,
  });

  app.enableShutdownHooks();

  const config = getEnvConfig(app.get(ConfigService));
  const missing = listMissingEnv(config);
  if (missing.length > 0) {
    logStartup('env', `Missing: ${missing.join(', ')}`, 'warn');
  }

  if (!config.REDIS_URL) {
    logStartup(
      'bootstrap',
      'REDIS_URL is required for the email worker process',
      'warn',
    );
  }

  logStartup(
    'bootstrap',
    `Email worker process running (PROCESS_ROLE=${config.PROCESS_ROLE})`,
  );
}

process.on('unhandledRejection', (reason) => {
  const error =
    reason instanceof Error ? reason : new Error(JSON.stringify(reason));
  emitServerFault(error, { process: { event: 'unhandledRejection' } });
});

process.on('uncaughtException', (err) => {
  emitServerFault(err, { process: { event: 'uncaughtException' } });
  process.exit(1);
});

bootstrap().catch((err: unknown) => {
  const error = err instanceof Error ? err : new Error(String(err));
  emitServerFault(error, {
    path: 'bootstrap',
    process: { event: 'bootstrapFailure' },
  });
  process.exit(1);
});
