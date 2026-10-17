import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';

import {
  customQueueJobName,
  customQueueJobPayload,
  sendEmailJobPayload,
} from '../../fixtures';
import { EMAIL_JOB_DEFAULTS, QueueService } from 'src/middleware';

jest.mock('evlog', () => ({
  log: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
  createError: jest.fn((input: Record<string, unknown>) => {
    const message = typeof input.message === 'string' ? input.message : 'error';
    const error = new Error(message);
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

const mockQueueAdd = jest.fn().mockResolvedValue(undefined);
const mockQueueClose = jest.fn().mockResolvedValue(undefined);
const mockQueueOn = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
    on: mockQueueOn,
  })),
}));

describe('QueueService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('exposes Option A job defaults', () => {
    expect(EMAIL_JOB_DEFAULTS).toEqual({
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    });
  });

  it('is disabled when REDIS_URL is unset', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ''),
          },
        },
      ],
    }).compile();

    const service = module.get(QueueService);
    service.onModuleInit();

    expect(service.isEnabled()).toBe(false);
    await expect(service.enqueueEmailSend(sendEmailJobPayload)).resolves.toBe(
      false,
    );
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('enqueues email job when REDIS_URL is configured', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'REDIS_URL' ? 'redis://localhost:6379' : '',
            ),
          },
        },
      ],
    }).compile();

    const service = module.get(QueueService);
    service.onModuleInit();

    expect(service.isEnabled()).toBe(true);
    expect(Queue).toHaveBeenCalledWith('email', {
      connection: {
        url: 'redis://localhost:6379',
        maxRetriesPerRequest: null,
        keepAlive: 10_000,
      },
    });
    expect(mockQueueOn).toHaveBeenCalledWith('error', expect.any(Function));
    await expect(service.enqueueEmailSend(sendEmailJobPayload)).resolves.toBe(
      true,
    );
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'email.send',
      sendEmailJobPayload,
      EMAIL_JOB_DEFAULTS,
    );
  });

  it('enqueue adds custom job names when queue is enabled', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'REDIS_URL' ? 'redis://localhost:6379' : '',
            ),
          },
        },
      ],
    }).compile();

    const service = module.get(QueueService);
    service.onModuleInit();

    await expect(
      service.enqueue(customQueueJobName, customQueueJobPayload),
    ).resolves.toBe(true);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      customQueueJobName,
      customQueueJobPayload,
      EMAIL_JOB_DEFAULTS,
    );
  });
});
