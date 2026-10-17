import { ConfigService } from '@nestjs/config';

import { log, createRequestLogger } from 'evlog';
import { createAxiomDrain } from 'evlog/axiom';
import {
  createUserAgentEnricher,
  createRequestSizeEnricher,
} from 'evlog/enrichers';
import { useLogger } from 'evlog/nestjs';
import { createDrainPipeline } from 'evlog/pipeline';
import { createFsDrain } from 'evlog/fs';

import {
  createEvlogDrain,
  createEvlogHttpOptions,
  createEvlogInitOptions,
  emitServerFault,
  logStartup,
  EVLOG_HEALTH_EXCLUDE,
  EVLOG_SERVER_ERROR_SAMPLING,
  evlogInputFromConfig,
  evlogInputFromEnv,
  EvlogShutdownHost,
  getRequestOrGlobalLogger,
  keepServerErrorEvents,
  mapLogLevel,
  resetEvlogDrainCache,
  resolveEvlogServiceName,
} from 'src/middleware';

jest.mock('evlog', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  createRequestLogger: jest.fn(() => ({
    set: jest.fn(),
    error: jest.fn(),
    emit: jest.fn(),
  })),
}));

jest.mock('evlog/nestjs', () => ({
  useLogger: jest.fn(),
}));

jest.mock('evlog/fs', () => ({
  createFsDrain: jest.fn(() => jest.fn()),
}));

jest.mock('evlog/axiom', () => ({
  createAxiomDrain: jest.fn(() => jest.fn()),
}));

jest.mock('evlog/pipeline', () => ({
  createDrainPipeline: jest.fn(
    () => (inner: (batch: unknown) => unknown) =>
      Object.assign(
        jest.fn((ctx: unknown) => inner(ctx)),
        {
          flush: jest.fn().mockResolvedValue(undefined),
          inner,
        },
      ),
  ),
}));

jest.mock('evlog/enrichers', () => ({
  createUserAgentEnricher: jest.fn(() => jest.fn()),
  createRequestSizeEnricher: jest.fn(() => jest.fn()),
}));

const developmentInput = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  PLATFORM_NAME: 'TestPlatform',
  AXIOM_API_KEY: '',
  AXIOM_DATASET: '',
};

describe('evlog factory', () => {
  beforeEach(() => {
    resetEvlogDrainCache();
    jest.clearAllMocks();
  });

  it('maps pino leftover levels onto evlog minLevel', () => {
    expect(mapLogLevel('fatal')).toBe('error');
    expect(mapLogLevel('trace')).toBe('debug');
    expect(mapLogLevel('debug')).toBe('debug');
    expect(mapLogLevel('info')).toBe('info');
    expect(mapLogLevel('warn')).toBe('warn');
    expect(mapLogLevel('error')).toBe('error');
    expect(mapLogLevel('verbose')).toBe('info');
  });

  it('uses PLATFORM_NAME when set and fallback otherwise', () => {
    expect(resolveEvlogServiceName('Builder', 'api')).toBe('Builder');
    expect(resolveEvlogServiceName('  ', 'worker')).toBe('worker');
  });

  it('does not attach drains in test env', () => {
    const drain = createEvlogDrain({ ...developmentInput, NODE_ENV: 'test' });
    const init = createEvlogInitOptions(
      { ...developmentInput, NODE_ENV: 'test' },
      'api',
    );

    expect(drain).toBeUndefined();
    expect(init.silent).toBe(true);
    expect(init.drain).toBeUndefined();
    expect(init.sampling).toEqual(EVLOG_SERVER_ERROR_SAMPLING);
    expect(createFsDrain).not.toHaveBeenCalled();
    expect(createAxiomDrain).not.toHaveBeenCalled();
  });

  it('attaches filesystem drain outside test when Axiom keys are missing', () => {
    createEvlogDrain(developmentInput);

    expect(createFsDrain).toHaveBeenCalledWith({ maxFiles: 14 });
    expect(createAxiomDrain).not.toHaveBeenCalled();
  });

  it('attaches pipelined Axiom drain only when both keys are set', () => {
    createEvlogDrain({
      ...developmentInput,
      AXIOM_API_KEY: 'xaat-test',
      AXIOM_DATASET: 'builder-logs',
    });

    expect(createFsDrain).toHaveBeenCalled();
    expect(createDrainPipeline).toHaveBeenCalled();
    expect(createAxiomDrain).toHaveBeenCalled();
  });

  it('does not attach Axiom when only one key is set', () => {
    createEvlogDrain({
      ...developmentInput,
      AXIOM_API_KEY: 'xaat-test',
      AXIOM_DATASET: '',
    });

    expect(createAxiomDrain).not.toHaveBeenCalled();
  });

  it('returns the same drain instance for the same process input', () => {
    const first = createEvlogDrain(developmentInput);
    const second = createEvlogDrain(developmentInput);
    expect(first).toBe(second);
  });

  it('excludes health and favicon routes', () => {
    const http = createEvlogHttpOptions(developmentInput);
    expect(http.exclude).toEqual([...EVLOG_HEALTH_EXCLUDE]);
  });

  it('keeps only 5xx HTTP events', () => {
    const kept = { status: 500, shouldKeep: false };
    const dropped = { status: 200, shouldKeep: false };
    const clientError = { status: 404, shouldKeep: false };

    keepServerErrorEvents(kept as never);
    keepServerErrorEvents(dropped as never);
    keepServerErrorEvents(clientError as never);

    expect(kept.shouldKeep).toBe(true);
    expect(dropped.shouldKeep).toBe(false);
    expect(clientError.shouldKeep).toBe(false);
    expect(createEvlogHttpOptions(developmentInput).keep).toBe(
      keepServerErrorEvents,
    );
    expect(EVLOG_SERVER_ERROR_SAMPLING).toEqual({
      rates: { info: 0, warn: 0, error: 0, debug: 0 },
      keep: [{ status: 500 }],
    });
  });

  it('emits server faults with status 500 so sampling keeps them', () => {
    const faultLog = {
      set: jest.fn(),
      error: jest.fn(),
      emit: jest.fn(),
    };
    (createRequestLogger as jest.Mock).mockReturnValueOnce(faultLog);

    const error = new Error('boom');
    emitServerFault(error, { process: { event: 'uncaughtException' } });

    expect(faultLog.error).toHaveBeenCalledWith(error);
    expect(faultLog.set).toHaveBeenCalledWith({
      process: { event: 'uncaughtException' },
    });
    expect(faultLog.set).toHaveBeenCalledWith({ status: 500 });
    expect(faultLog.emit).toHaveBeenCalled();
  });

  it('emits a message-only fault without a stack or extra console fields', () => {
    const faultLog = {
      set: jest.fn(),
      error: jest.fn(),
      emit: jest.fn(),
    };
    (createRequestLogger as jest.Mock).mockReturnValueOnce(faultLog);

    const checks = {
      redis: { status: 'down' as const, reason: 'REDIS_URL is unset' },
    };
    emitServerFault('redis unavailable: REDIS_URL is unset', {
      health: { check: 'readiness', checks },
    });

    expect(faultLog.error).not.toHaveBeenCalled();
    expect(faultLog.set).toHaveBeenCalledWith({
      error: {
        message: 'redis unavailable: REDIS_URL is unset',
        internal: { health: { check: 'readiness', checks } },
      },
    });
    expect(faultLog.set).toHaveBeenCalledWith({ status: 500 });
    expect(faultLog.emit).toHaveBeenCalled();
  });

  it('force-keeps startup lines so they print when info sampling is 0', () => {
    const bootLog = {
      set: jest.fn(),
      error: jest.fn(),
      emit: jest.fn(),
    };
    (createRequestLogger as jest.Mock).mockReturnValueOnce(bootLog);

    logStartup('bootstrap', 'Server running at http://localhost:3000');

    expect(bootLog.set).toHaveBeenCalledWith({
      bootstrap: 'Server running at http://localhost:3000',
    });
    expect(bootLog.emit).toHaveBeenCalledWith({ _forceKeep: true });
  });

  it('emits missing-env startup lines at warn', () => {
    const bootLog = {
      set: jest.fn(),
      setLevel: jest.fn(),
      error: jest.fn(),
      emit: jest.fn(),
    };
    (createRequestLogger as jest.Mock).mockReturnValueOnce(bootLog);

    logStartup('env', 'Missing: REDIS_URL', 'warn');

    expect(bootLog.set).toHaveBeenCalledWith({
      env: 'Missing: REDIS_URL',
    });
    expect(bootLog.setLevel).toHaveBeenCalledWith('warn');
    expect(bootLog.emit).toHaveBeenCalledWith({ _forceKeep: true });
  });

  it('invokes filesystem and Axiom drains then flushes them', async () => {
    const fsDrain = jest.fn();
    const axiomDrain = jest.fn();
    (createFsDrain as jest.Mock).mockReturnValueOnce(fsDrain);
    (createAxiomDrain as jest.Mock).mockReturnValueOnce(axiomDrain);

    const drain = createEvlogDrain({
      ...developmentInput,
      AXIOM_API_KEY: 'xaat-test',
      AXIOM_DATASET: 'builder-logs',
    });

    const ctx = { event: 'http' };
    drain?.(ctx as never);
    await drain?.flush?.();

    expect(fsDrain).toHaveBeenCalledWith(ctx);
    expect(axiomDrain).toHaveBeenCalledWith(ctx);
  });

  it('runs HTTP enrichers against the request context', () => {
    const userAgent = jest.fn();
    const requestSize = jest.fn();
    (createUserAgentEnricher as jest.Mock).mockReturnValueOnce(userAgent);
    (createRequestSizeEnricher as jest.Mock).mockReturnValueOnce(requestSize);

    const http = createEvlogHttpOptions(developmentInput);
    const ctx = { request: { method: 'GET' } };
    http.enrich(ctx as never);

    expect(userAgent).toHaveBeenCalledWith(ctx);
    expect(requestSize).toHaveBeenCalledWith(ctx);
  });

  it('wraps the request-scoped logger when useLogger succeeds', () => {
    const requestLog = {
      set: jest.fn(),
      error: jest.fn(),
    };
    (useLogger as jest.Mock).mockReturnValue(requestLog);

    const scoped = getRequestOrGlobalLogger();
    const fields = { email: { template: 'welcome', toCount: 1 } };
    const error = new Error('send failed');

    scoped.set(fields);
    scoped.error(error);
    scoped.warn(fields);
    scoped.info(fields);

    expect(requestLog.set).toHaveBeenCalledWith(fields);
    expect(requestLog.error).toHaveBeenCalledWith(error);
    expect(requestLog.set).toHaveBeenCalledTimes(3);
  });

  it('falls back to the global logger when useLogger throws', () => {
    (useLogger as jest.Mock).mockImplementation(() => {
      throw new Error('no request scope');
    });

    const scoped = getRequestOrGlobalLogger();
    const fields = { queue: { enabled: false } };
    const error = new Error('boom');

    scoped.set(fields);
    scoped.error(error);
    scoped.warn(fields);
    scoped.info(fields);

    expect(
      (log as unknown as { info: { mock: { calls: unknown[] } } }).info.mock
        .calls,
    ).toEqual([[fields], [fields]]);
    expect(
      (log as unknown as { error: { mock: { calls: unknown[] } } }).error.mock
        .calls,
    ).toEqual([[error]]);
    expect(
      (log as unknown as { warn: { mock: { calls: unknown[] } } }).warn.mock
        .calls,
    ).toEqual([[fields]]);
  });

  it('flushes the drain on application shutdown', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const host = new EvlogShutdownHost(
      Object.assign(jest.fn(), { flush }) as never,
    );

    await host.onApplicationShutdown();
    expect(flush).toHaveBeenCalled();

    await new EvlogShutdownHost(undefined).onApplicationShutdown();
  });

  it('maps ConfigService and process.env into factory input', () => {
    const fromEnv = evlogInputFromEnv({
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      PLATFORM_NAME: 'P',
      AXIOM_API_KEY: 'k',
      AXIOM_DATASET: 'd',
    });
    expect(fromEnv).toEqual({
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      PLATFORM_NAME: 'P',
      AXIOM_API_KEY: 'k',
      AXIOM_DATASET: 'd',
    });

    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          NODE_ENV: 'production',
          LOG_LEVEL: 'warn',
          PLATFORM_NAME: 'Prod',
          AXIOM_API_KEY: '',
          AXIOM_DATASET: '',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    expect(evlogInputFromConfig(config).NODE_ENV).toBe('production');
  });

  it('defaults missing env and config values', () => {
    expect(evlogInputFromEnv({})).toEqual({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      PLATFORM_NAME: '',
      AXIOM_API_KEY: '',
      AXIOM_DATASET: '',
    });

    const config = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    expect(evlogInputFromConfig(config)).toEqual({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      PLATFORM_NAME: '',
      AXIOM_API_KEY: '',
      AXIOM_DATASET: '',
    });
  });
});
