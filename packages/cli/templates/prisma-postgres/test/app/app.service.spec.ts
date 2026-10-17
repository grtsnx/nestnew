import { HealthCheckError, HealthCheckService } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';
import { createRequestLogger } from 'evlog';

import { AppService } from 'src/app';
import {
  handleResponse,
  QueueHealthIndicator,
  RedisHealthIndicator,
} from 'src/middleware';

jest.mock('evlog', () => ({
  log: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
  createError: jest.fn((input: Record<string, unknown>) => {
    const error = new Error(String(input.message ?? 'error'));
    error.name = 'EvlogError';
    Object.assign(error, input);
    return error;
  }),
  createRequestLogger: jest.fn(() => ({
    set: jest.fn(),
    setLevel: jest.fn(),
    error: jest.fn(),
    emit: jest.fn(),
  })),
}));

describe('AppService', () => {
  let appService: AppService;
  let healthCheckService: { check: jest.Mock };
  let redisHealth: { isHealthy: jest.Mock };
  let queueHealth: { isHealthy: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    healthCheckService = {
      check: jest.fn().mockResolvedValue({
        status: 'ok',
        info: { redis: { status: 'up' }, queue: { status: 'up' } },
      }),
    };
    redisHealth = { isHealthy: jest.fn() };
    queueHealth = { isHealthy: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: RedisHealthIndicator, useValue: redisHealth },
        { provide: QueueHealthIndicator, useValue: queueHealth },
      ],
    }).compile();

    appService = app.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should return Hello World', () => {
      expect(appService.getHello()).toBe('Hello World!');
    });
  });

  describe('getHealth', () => {
    it('should throw handleResponse with up status', () => {
      expect(() => appService.getHealth()).toThrow(handleResponse);

      try {
        appService.getHealth();
      } catch (error) {
        expect(error).toBeInstanceOf(handleResponse);
        expect((error as handleResponse).getResponse()).toEqual({
          statusCode: 200,
          statusType: 'OK',
          message: 'Server is up',
          data: { status: 'up' },
        });
      }
    });
  });

  describe('getReadiness', () => {
    it('should throw handleResponse with 200 when all checks pass', async () => {
      const checkResult = {
        status: 'ok',
        info: { redis: { status: 'up' }, queue: { status: 'up' } },
      };
      healthCheckService.check.mockResolvedValue(checkResult);

      await expect(appService.getReadiness()).rejects.toBeInstanceOf(
        handleResponse,
      );

      try {
        await appService.getReadiness();
      } catch (error) {
        expect((error as handleResponse).getResponse()).toEqual({
          statusCode: 200,
          statusType: 'OK',
          message: 'Services ready',
          data: {
            redis: { status: 'up' },
            queue: { status: 'up' },
          },
        });
      }
    });

    it('should throw handleResponse with 503 when a check fails', async () => {
      const causes = { redis: { status: 'down', message: 'PING failed' } };
      healthCheckService.check.mockRejectedValue(
        new HealthCheckError('Redis ping failed', causes),
      );

      try {
        await appService.getReadiness();
        throw new Error('expected getReadiness to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(handleResponse);
        expect((error as handleResponse).getStatus()).toBe(503);
        expect((error as handleResponse).getResponse()).toEqual({
          statusCode: 503,
          statusType: 'SERVICE_UNAVAILABLE',
          message: 'Redis unavailable',
          data: {
            redis: { status: 'down', reason: 'PING failed' },
          },
        });
        expect(createRequestLogger).toHaveBeenCalled();
        const faultLog = (createRequestLogger as jest.Mock).mock.results.at(-1)
          ?.value as {
          error: jest.Mock;
          set: jest.Mock;
          setLevel: jest.Mock;
          emit: jest.Mock;
        };
        expect(faultLog.error).not.toHaveBeenCalled();
        expect(faultLog.setLevel).toHaveBeenCalledWith('error');
        expect(faultLog.set).toHaveBeenCalledWith(
          expect.objectContaining({
            health: {
              check: 'readiness',
              checks: {
                redis: { status: 'down', reason: 'PING failed' },
              },
            },
            error: 'Redis unavailable',
            why: expect.any(String),
            fix: expect.any(String),
            status: 500,
          }),
        );
        expect(faultLog.emit).toHaveBeenCalled();
      }
    });
  });
});
