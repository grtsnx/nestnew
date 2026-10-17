import { HealthCheckError } from '@nestjs/terminus';

import { RedisService } from 'src/lib';
import {
  EmailProcessor,
  QueueHealthIndicator,
  QueueService,
  RedisHealthIndicator,
} from 'src/middleware';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let redisService: { isEnabled: jest.Mock; ping: jest.Mock };

  beforeEach(() => {
    redisService = {
      isEnabled: jest.fn(),
      ping: jest.fn(),
    };
    indicator = new RedisHealthIndicator(
      redisService as unknown as RedisService,
    );
  });

  it('returns healthy when redis responds to ping', async () => {
    redisService.isEnabled.mockReturnValue(true);
    redisService.ping.mockResolvedValue(true);

    await expect(indicator.isHealthy('redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
  });

  it('throws when redis is not configured', async () => {
    redisService.isEnabled.mockReturnValue(false);

    await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });

  it('throws when redis ping fails', async () => {
    redisService.isEnabled.mockReturnValue(true);
    redisService.ping.mockResolvedValue(false);

    await expect(indicator.isHealthy('redis')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });
});

describe('QueueHealthIndicator', () => {
  let indicator: QueueHealthIndicator;
  let queueService: { isEnabled: jest.Mock };
  let emailProcessor: { isRunning: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    queueService = { isEnabled: jest.fn() };
    emailProcessor = { isRunning: jest.fn() };
    configService = {
      get: jest.fn((key: string) =>
        key === 'PROCESS_ROLE' ? 'all' : undefined,
      ),
    };
    indicator = new QueueHealthIndicator(
      queueService as unknown as QueueService,
      emailProcessor as unknown as EmailProcessor,
      configService as never,
    );
  });

  it('returns healthy when queue is enabled and worker is running', () => {
    queueService.isEnabled.mockReturnValue(true);
    emailProcessor.isRunning.mockReturnValue(true);
    expect(indicator.isHealthy('queue')).toEqual({
      queue: { status: 'up' },
    });
  });

  it('returns healthy for PROCESS_ROLE=api without a local worker', () => {
    configService.get.mockImplementation((key: string) =>
      key === 'PROCESS_ROLE' ? 'api' : undefined,
    );
    queueService.isEnabled.mockReturnValue(true);
    emailProcessor.isRunning.mockReturnValue(false);
    expect(indicator.isHealthy('queue')).toEqual({
      queue: { status: 'up' },
    });
  });

  it('throws when queue is not configured', () => {
    queueService.isEnabled.mockReturnValue(false);
    expect(() => indicator.isHealthy('queue')).toThrow(HealthCheckError);
  });

  it('throws when queue is enabled but email worker is not running', () => {
    queueService.isEnabled.mockReturnValue(true);
    emailProcessor.isRunning.mockReturnValue(false);

    expect(() => indicator.isHealthy('queue')).toThrow(HealthCheckError);
    try {
      indicator.isHealthy('queue');
    } catch (error) {
      expect((error as HealthCheckError).causes).toEqual({
        queue: {
          status: 'down',
          message: 'email worker is not running',
        },
      });
    }
  });
});
