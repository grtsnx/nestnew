import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { initLogger } from 'evlog';

import { AppModule } from 'src/app';
import {
  configureApp,
  createEvlogInitOptions,
  emitServerFault,
  evlogInputFromEnv,
  logStartup,
  isApiDocsEnabled,
  listMissingEnv,
  setupApiDocs,
} from 'src/middleware';

const evlogInit = createEvlogInitOptions(evlogInputFromEnv(process.env), 'api');
initLogger(evlogInit);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ['error', 'warn', 'fatal'],
  });

  const config = configureApp(app);
  const missing = listMissingEnv(config);
  if (missing.length > 0) {
    logStartup('env', `Missing: ${missing.join(', ')}`, 'warn');
  }
  await setupApiDocs(app, config);
  const port = config.PORT;

  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;
  logStartup('bootstrap', `Server running at ${baseUrl}`);

  if (isApiDocsEnabled(config)) {
    logStartup('bootstrap', `Swagger UI: ${baseUrl}/v1/docs`);
    logStartup(
      'bootstrap',
      `Scalar API Reference: ${baseUrl}/v1/api-reference`,
    );
  } else {
    logStartup('bootstrap', 'API documentation endpoints disabled.');
  }
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
  emitServerFault(error, { process: { event: 'bootstrapFailure' } });
  process.exit(1);
});
