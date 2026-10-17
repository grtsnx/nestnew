import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { configureApp, isApiDocsEnabled } from 'src/middleware';

import { productionEnvConfig, testEnvConfig } from '../../fixtures';

describe('configureApp', () => {
  let app: INestApplication;
  let useLogger: jest.Mock;
  let enableShutdownHooks: jest.Mock;
  let enableVersioning: jest.Mock;
  let useGlobalPipes: jest.Mock;

  beforeEach(() => {
    useLogger = jest.fn();
    enableShutdownHooks = jest.fn();
    enableVersioning = jest.fn();
    useGlobalPipes = jest.fn();

    app = {
      useLogger,
      enableShutdownHooks,
      getHttpAdapter: jest.fn().mockReturnValue({
        getInstance: jest.fn().mockReturnValue({
          disable: jest.fn(),
          set: jest.fn(),
        }),
      }),
      use: jest.fn(),
      enableVersioning,
      enableCors: jest.fn(),
      useGlobalPipes,
      get: jest.fn((token: unknown) => {
        if (token === ConfigService) {
          return {
            get: jest.fn((key: string) => {
              const values: Record<string, string | number> = {
                PORT: 3000,
                NODE_ENV: 'development',
                PRODUCTION_URL: 'http://localhost:3000',
                DEVELOPMENT_URL: 'http://localhost:3000',
                PLATFORM_URL: 'http://localhost:3000',
                PLATFORM_NAME: 'TestPlatform',
                ENABLE_API_DOCS: 'true',
                LOG_LEVEL: 'info',
                CORS_ORIGINS: '',
              };
              return values[key];
            }),
          };
        }

        return undefined;
      }),
    } as unknown as INestApplication;
  });

  it('registers security middleware and returns env config', () => {
    const config = configureApp(app);

    expect(useLogger).not.toHaveBeenCalled();
    expect(enableShutdownHooks).toHaveBeenCalled();
    expect(enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
    });
    expect(useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
    expect(config.PORT).toBe(3000);
    expect(config.PLATFORM_NAME).toBe('TestPlatform');
  });
});

describe('isApiDocsEnabled', () => {
  it('returns true in development by default', () => {
    expect(isApiDocsEnabled(testEnvConfig)).toBe(true);
  });

  it('returns false in production unless explicitly enabled', () => {
    expect(isApiDocsEnabled(productionEnvConfig)).toBe(false);
  });
});
