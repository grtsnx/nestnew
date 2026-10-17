import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRequestLogger,
  log,
  type DrainContext,
  type EnrichContext,
  type SamplingConfig,
  type TailSamplingContext,
} from 'evlog';
import { createAxiomDrain } from 'evlog/axiom';
import {
  createRequestSizeEnricher,
  createUserAgentEnricher,
} from 'evlog/enrichers';
import { createFsDrain } from 'evlog/fs';
import { useLogger } from 'evlog/nestjs';
import { createDrainPipeline } from 'evlog/pipeline';

export const EVLOG_HEALTH_EXCLUDE = [
  '/',
  '/health',
  '/health/ready',
  '/favicon.ico',
  '/json',
  '/json/**',
] as const;

/** Drop all levels by default; force-keep only status ≥ 500 (server faults). */
export const EVLOG_SERVER_ERROR_SAMPLING: SamplingConfig = {
  rates: { info: 0, warn: 0, error: 0, debug: 0 },
  keep: [{ status: 500 }],
};

export type EvlogMinLevel = 'debug' | 'info' | 'warn' | 'error';

export interface EvlogFactoryInput {
  NODE_ENV: string;
  LOG_LEVEL: string;
  PLATFORM_NAME: string;
  AXIOM_API_KEY: string;
  AXIOM_DATASET: string;
}

export type EvlogFlushableDrain = ((ctx: DrainContext) => void) & {
  flush?: () => Promise<void>;
};

export interface EvlogInitOptions {
  env: { service: string; environment: string };
  minLevel: EvlogMinLevel;
  drain?: EvlogFlushableDrain;
  silent: boolean;
  sampling: SamplingConfig;
}

export interface EvlogHttpModuleOptions {
  drain?: EvlogFlushableDrain;
  exclude: string[];
  enrich: (ctx: EnrichContext) => void;
  keep: (ctx: TailSamplingContext) => void;
}

export interface EvlogScopedLogger {
  set: (fields: Record<string, unknown>) => void;
  error: (error: Error) => void;
  warn: (event: Record<string, unknown>) => void;
  info: (event: Record<string, unknown>) => void;
}

type DrainCache = {
  key: string;
  drain: EvlogFlushableDrain | undefined;
};

let drainCache: DrainCache | undefined;

export function mapLogLevel(level: string): EvlogMinLevel {
  if (level === 'fatal') {
    return 'error';
  }
  if (level === 'trace') {
    return 'debug';
  }
  if (
    level === 'debug' ||
    level === 'info' ||
    level === 'warn' ||
    level === 'error'
  ) {
    return level;
  }
  return 'info';
}

export function resolveEvlogServiceName(
  platformName: string,
  fallback: 'api' | 'worker',
): string {
  const trimmed = platformName.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function evlogInputFromEnv(
  source: Record<string, string | undefined>,
): EvlogFactoryInput {
  return {
    NODE_ENV: source.NODE_ENV ?? 'development',
    LOG_LEVEL: (source.LOG_LEVEL ?? 'info').toLowerCase(),
    PLATFORM_NAME: source.PLATFORM_NAME ?? '',
    AXIOM_API_KEY: source.AXIOM_API_KEY ?? '',
    AXIOM_DATASET: source.AXIOM_DATASET ?? '',
  };
}

export function evlogInputFromConfig(config: ConfigService): EvlogFactoryInput {
  return {
    NODE_ENV: config.get<string>('NODE_ENV') ?? 'development',
    LOG_LEVEL: (config.get<string>('LOG_LEVEL') ?? 'info').toLowerCase(),
    PLATFORM_NAME: config.get<string>('PLATFORM_NAME') ?? '',
    AXIOM_API_KEY: config.get<string>('AXIOM_API_KEY') ?? '',
    AXIOM_DATASET: config.get<string>('AXIOM_DATASET') ?? '',
  };
}

export function resetEvlogDrainCache(): void {
  drainCache = undefined;
}

function drainCacheKey(input: EvlogFactoryInput): string {
  return `${input.NODE_ENV}|${input.AXIOM_API_KEY}|${input.AXIOM_DATASET}`;
}

function buildEvlogDrain(
  input: EvlogFactoryInput,
): EvlogFlushableDrain | undefined {
  if (input.NODE_ENV === 'test') {
    return undefined;
  }

  const drains: Array<(ctx: DrainContext) => void | Promise<void>> = [
    createFsDrain({ maxFiles: 14 }),
  ];

  const axiomKey = input.AXIOM_API_KEY.trim();
  const axiomDataset = input.AXIOM_DATASET.trim();
  if (axiomKey && axiomDataset) {
    const axiomDrain = createAxiomDrain();
    const piped = createDrainPipeline<DrainContext>({
      batch: { size: 50, intervalMs: 5000 },
      retry: { maxAttempts: 3 },
    })((batch) => axiomDrain(batch));
    drains.push(piped);
  }

  return Object.assign(
    (ctx: DrainContext) => {
      void Promise.allSettled(
        drains.map((entry) => Promise.resolve(entry(ctx))),
      );
    },
    {
      flush: async () => {
        await Promise.allSettled(
          drains.map((entry) => {
            const flushable = entry as EvlogFlushableDrain;
            return flushable.flush?.() ?? Promise.resolve();
          }),
        );
      },
    },
  );
}

export function createEvlogDrain(
  input: EvlogFactoryInput,
): EvlogFlushableDrain | undefined {
  const key = drainCacheKey(input);
  if (drainCache?.key === key) {
    return drainCache.drain;
  }
  const drain = buildEvlogDrain(input);
  drainCache = { key, drain };
  return drain;
}

export function createEvlogInitOptions(
  input: EvlogFactoryInput,
  fallbackService: 'api' | 'worker',
): EvlogInitOptions {
  return {
    env: {
      service: resolveEvlogServiceName(input.PLATFORM_NAME, fallbackService),
      environment: input.NODE_ENV,
    },
    minLevel: mapLogLevel(input.LOG_LEVEL),
    drain: createEvlogDrain(input),
    silent: input.NODE_ENV === 'test',
    sampling: EVLOG_SERVER_ERROR_SAMPLING,
  };
}

export function keepServerErrorEvents(ctx: TailSamplingContext): void {
  if ((ctx.status ?? 0) >= 500) {
    ctx.shouldKeep = true;
  }
}

/**
 * Emit a force-kept server fault (status 500) outside HTTP middleware —
 * process crashes, worker job failures, readiness checks excluded from HTTP logs.
 */
export function emitServerFault(
  error: Error | string,
  fields?: Record<string, unknown>,
): void {
  const faultLog = createRequestLogger({});
  if (typeof error === 'string') {
    faultLog.set({
      error:
        fields === undefined
          ? error
          : { message: error, internal: fields },
    });
  } else {
    faultLog.error(error);
    if (fields) {
      faultLog.set(fields);
    }
  }
  faultLog.set({ status: 500 });
  faultLog.emit();
}

export function logStartup(
  tag: string,
  message: string,
  level: 'info' | 'warn' = 'info',
): void {
  const bootLog = createRequestLogger({});
  bootLog.set({ [tag]: message });
  if (level === 'warn') {
    bootLog.setLevel('warn');
  }
  bootLog.emit({ _forceKeep: true });
}

export function createEvlogHttpOptions(
  input: EvlogFactoryInput,
): EvlogHttpModuleOptions {
  const userAgent = createUserAgentEnricher();
  const requestSize = createRequestSizeEnricher();
  return {
    drain: createEvlogDrain(input),
    exclude: [...EVLOG_HEALTH_EXCLUDE],
    enrich: (ctx) => {
      userAgent(ctx);
      requestSize(ctx);
    },
    keep: keepServerErrorEvents,
  };
}

export function getRequestOrGlobalLogger(): EvlogScopedLogger {
  try {
    const requestLog = useLogger();
    return {
      set: (fields) => {
        requestLog.set(fields);
      },
      error: (error) => {
        requestLog.error(error);
      },
      warn: (event) => {
        requestLog.set(event);
      },
      info: (event) => {
        requestLog.set(event);
      },
    };
  } catch {
    return {
      set: (fields) => {
        log.info(fields);
      },
      error: (error) => {
        log.error(error);
      },
      warn: (event) => {
        log.warn(event);
      },
      info: (event) => {
        log.info(event);
      },
    };
  }
}

@Injectable()
export class EvlogShutdownHost implements OnApplicationShutdown {
  constructor(private readonly drain: EvlogFlushableDrain | undefined) {}

  async onApplicationShutdown(): Promise<void> {
    await this.drain?.flush?.();
  }
}
