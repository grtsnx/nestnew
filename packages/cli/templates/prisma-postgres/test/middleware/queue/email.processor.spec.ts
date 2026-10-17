import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { processorEmailJobPayload, unknownQueueJobName } from '../../fixtures';
import { SendMailsService } from 'src/lib';
import { EmailProcessor } from 'src/middleware';
import { createRequestLogger } from 'evlog';

const mockWorkerOn = jest.fn();
const mockWorkerClose = jest.fn().mockResolvedValue(undefined);

jest.mock('evlog', () => ({
  log: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
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

type EmailJobHandler = (job: {
  name: string;
  data: Record<string, unknown>;
}) => Promise<void>;

let capturedJobHandler: EmailJobHandler | null = null;
let capturedWorkerOpts: { connection?: Record<string, unknown> } | null = null;

jest.mock('bullmq', () => ({
  Worker: jest
    .fn()
    .mockImplementation(
      (
        _queue: string,
        processor: EmailJobHandler,
        opts: { connection?: Record<string, unknown> },
      ) => {
        capturedJobHandler = processor;
        capturedWorkerOpts = opts;
        return {
          on: mockWorkerOn,
          close: mockWorkerClose,
        };
      },
    ),
}));

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let sendMailsService: { sendEmail: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedJobHandler = null;
    capturedWorkerOpts = null;
    sendMailsService = { sendEmail: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REDIS_URL') {
                return 'redis://localhost:6379';
              }
              if (key === 'NODE_ENV') {
                return 'development';
              }
              return '';
            }),
          },
        },
        {
          provide: SendMailsService,
          useValue: sendMailsService,
        },
      ],
    }).compile();

    processor = module.get(EmailProcessor);
  });

  it('starts worker when redis is configured outside test env', () => {
    expect(processor.isRunning()).toBe(false);
    processor.onModuleInit();
    expect(processor.isRunning()).toBe(true);
    expect(capturedWorkerOpts?.connection).toEqual({
      url: 'redis://localhost:6379',
      maxRetriesPerRequest: null,
      keepAlive: 10_000,
    });
    expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith('error', expect.any(Function));
    expect(createRequestLogger).toHaveBeenCalled();
  });

  it('processes email.send jobs via worker handler', async () => {
    processor.onModuleInit();

    await capturedJobHandler?.({
      name: 'email.send',
      data: processorEmailJobPayload,
    });

    expect(sendMailsService.sendEmail).toHaveBeenCalledWith(
      processorEmailJobPayload.to,
      processorEmailJobPayload.subject,
      processorEmailJobPayload.template,
      processorEmailJobPayload.context,
    );
    expect(createRequestLogger).toHaveBeenCalled();
    const jobLog = (createRequestLogger as jest.Mock).mock.results.at(-1)
      ?.value as { emit: jest.Mock };
    expect(jobLog.emit).toHaveBeenCalled();
  });

  it('ignores unknown job names', async () => {
    processor.onModuleInit();

    await capturedJobHandler?.({
      name: unknownQueueJobName,
      data: processorEmailJobPayload,
    });

    expect(sendMailsService.sendEmail).not.toHaveBeenCalled();
    expect(createRequestLogger).toHaveBeenCalled();
    const jobLog = (createRequestLogger as jest.Mock).mock.results.at(-1)
      ?.value as { emit: jest.Mock };
    expect(jobLog.emit).toHaveBeenCalled();
  });

  it('skips worker startup when PROCESS_ROLE=api', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REDIS_URL') {
                return 'redis://localhost:6379';
              }
              if (key === 'NODE_ENV') {
                return 'development';
              }
              if (key === 'PROCESS_ROLE') {
                return 'api';
              }
              return '';
            }),
          },
        },
        {
          provide: SendMailsService,
          useValue: sendMailsService,
        },
      ],
    }).compile();

    const apiProcessor = module.get(EmailProcessor);
    apiProcessor.onModuleInit();
    expect(apiProcessor.isRunning()).toBe(false);
    expect(mockWorkerOn).not.toHaveBeenCalled();
  });

  it('skips worker startup in test environment', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'NODE_ENV' ? 'test' : 'redis://localhost:6379',
            ),
          },
        },
        {
          provide: SendMailsService,
          useValue: sendMailsService,
        },
      ],
    }).compile();

    module.get(EmailProcessor).onModuleInit();
    expect(mockWorkerOn).not.toHaveBeenCalled();
  });

  it('skips worker startup when REDIS_URL is unset', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'NODE_ENV' ? 'development' : '',
            ),
          },
        },
        {
          provide: SendMailsService,
          useValue: sendMailsService,
        },
      ],
    }).compile();

    module.get(EmailProcessor).onModuleInit();
    expect(mockWorkerOn).not.toHaveBeenCalled();
  });

  it('closes worker on module destroy', async () => {
    processor.onModuleInit();
    expect(processor.isRunning()).toBe(true);
    await processor.onModuleDestroy();
    expect(mockWorkerClose).toHaveBeenCalled();
    expect(processor.isRunning()).toBe(false);
  });

  it('logs and rethrows when sendEmail fails', async () => {
    sendMailsService.sendEmail.mockRejectedValue(new Error('smtp down'));
    processor.onModuleInit();

    await expect(
      capturedJobHandler?.({
        name: 'email.send',
        data: processorEmailJobPayload,
      }),
    ).rejects.toThrow('smtp down');

    const jobLog = (createRequestLogger as jest.Mock).mock.results.at(-1)
      ?.value as {
      error: jest.Mock;
      set: jest.Mock;
      setLevel: jest.Mock;
      emit: jest.Mock;
    };
    expect(jobLog.error).not.toHaveBeenCalled();
    expect(jobLog.setLevel).toHaveBeenCalledWith('error');
    expect(jobLog.set).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'smtp down',
        why: expect.any(String),
        fix: expect.any(String),
      }),
    );
    expect(jobLog.set).toHaveBeenCalledWith({ status: 500 });
    expect(jobLog.emit).toHaveBeenCalled();
  });

  it('emits a force-kept server fault on worker failed events', () => {
    processor.onModuleInit();
    const failedCall = mockWorkerOn.mock.calls.find(
      (call: unknown) => Array.isArray(call) && call[0] === 'failed',
    ) as [string, (job: unknown, error: Error) => void] | undefined;

    const error = new Error('job failed');
    failedCall?.[1](undefined, error);

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
        error: 'job failed',
        why: expect.any(String),
        fix: expect.any(String),
        status: 500,
      }),
    );
    expect(faultLog.emit).toHaveBeenCalled();
  });
});
