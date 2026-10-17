import { EventEmitter } from 'node:events';

import { ConfigService } from '@nestjs/config';
import { createRequestLogger } from 'evlog';

import { redisConnectionConfig, redisUrlFixtures } from '../../fixtures';
import {
  attachRedisErrorListener,
  getRedisConnectionOptions,
  toBullmqConnection,
  toRedisOptions,
  wrapRedisError,
} from 'src/middleware';

jest.mock('evlog', () => ({
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

function createConfigService(value: string): ConfigService {
  return {
    get: jest.fn(() => value),
  } as unknown as ConfigService;
}

function lastLogger(): {
  set: jest.Mock;
  setLevel: jest.Mock;
  emit: jest.Mock;
} {
  return (createRequestLogger as jest.Mock).mock.results.at(-1)?.value as {
    set: jest.Mock;
    setLevel: jest.Mock;
    emit: jest.Mock;
  };
}

describe('getRedisConnectionOptions', () => {
  it('returns null when REDIS_URL is empty', () => {
    expect(
      getRedisConnectionOptions(createConfigService(redisUrlFixtures.unset)),
    ).toBeNull();
  });

  it('returns null when REDIS_URL is whitespace', () => {
    expect(
      getRedisConnectionOptions(
        createConfigService(redisUrlFixtures.whitespace),
      ),
    ).toBeNull();
  });

  it('returns lazyConnect config with TCP keepalive when REDIS_URL is set', () => {
    expect(
      getRedisConnectionOptions(createConfigService(redisUrlFixtures.valid)),
    ).toEqual(redisConnectionConfig);
  });
});

describe('toRedisOptions', () => {
  it('passes keepalive and retry settings to ioredis', () => {
    expect(toRedisOptions(redisConnectionConfig)).toEqual({
      lazyConnect: true,
      maxRetriesPerRequest: null,
      keepAlive: 10_000,
    });
  });
});

describe('toBullmqConnection', () => {
  it('passes url, retries, and keepalive without lazyConnect', () => {
    expect(toBullmqConnection(redisConnectionConfig)).toEqual({
      url: redisUrlFixtures.valid,
      maxRetriesPerRequest: null,
      keepAlive: 10_000,
    });
  });
});

describe('attachRedisErrorListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('warns on idle TLS timeouts instead of emitting a server fault', () => {
    const emitter = new EventEmitter();
    attachRedisErrorListener(emitter, 'queue');

    const error = Object.assign(new Error('read ETIMEDOUT'), {
      code: 'ETIMEDOUT',
      syscall: 'read',
    });
    emitter.emit('error', error);

    const log = lastLogger();
    expect(log.setLevel).toHaveBeenCalledWith('warn');
    expect(log.set).toHaveBeenCalledWith({
      redis: {
        source: 'queue',
        event: 'disconnect',
        code: 'ETIMEDOUT',
        syscall: 'read',
      },
      error: 'read ETIMEDOUT',
    });
    expect(log.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 }),
    );
    expect(log.emit).toHaveBeenCalledWith({ _forceKeep: true });
  });

  it('emits a server fault for unexpected redis errors', () => {
    const emitter = new EventEmitter();
    attachRedisErrorListener(emitter, 'worker');

    emitter.emit('error', new Error('WRONGPASS invalid password'));

    const log = lastLogger();
    expect(log.setLevel).toHaveBeenCalledWith('error');
    expect(log.set).toHaveBeenCalledWith(
      expect.objectContaining({
        redis: { source: 'worker', event: 'error' },
        error: 'WRONGPASS invalid password',
        status: 500,
      }),
    );
    expect(log.emit).toHaveBeenCalled();
  });
});

describe('wrapRedisError', () => {
  it('wraps Error instances with operation context', () => {
    expect(() => wrapRedisError('getting data', new Error('timeout'))).toThrow(
      'Error getting data in Redis: timeout',
    );
  });

  it('wraps non-Error values', () => {
    expect(() => wrapRedisError('saving data', 'broken')).toThrow(
      'Error saving data in Redis: broken',
    );
  });

  it('preserves original error as cause', () => {
    const original = new Error('timeout');

    try {
      wrapRedisError('getting data', original);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).cause).toBe(original);
    }
  });
});
