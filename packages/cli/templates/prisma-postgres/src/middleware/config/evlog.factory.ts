import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createError,
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
  pretty?: boolean;
  dev?: {
    prettyError?: {
      snippet?: boolean;
      stackDepth?: number;
      compact?: boolean;
      detail?: 'full' | 'guidance';
    };
  };
}

export interface EvlogHttpModuleOptions {
  drain?: EvlogFlushableDrain;
  exclude: string[];
  enrich: (ctx: EnrichContext) => void;
  keep: (ctx: TailSamplingContext) => void;
}

export interface EvlogScopedLogger {
  set: (fields: Record<string, unknown>) => void;
  setLevel?: (level: 'debug' | 'info' | 'warn' | 'error') => void;
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

function isServerFaultDrainEvent(event: DrainContext['event']): boolean {
  if (event.level === 'error') {
    return true;
  }
  return typeof event.status === 'number' && event.status >= 500;
}

function buildEvlogDrain(
  input: EvlogFactoryInput,
): EvlogFlushableDrain | undefined {
  if (input.NODE_ENV === 'test') {
    return undefined;
  }

  const drains: Array<(ctx: DrainContext) => void | Promise<void>> = [
    createFsDrain({ maxFiles: 14, pretty: true }),
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
      if (!isServerFaultDrainEvent(ctx.event)) {
        return;
      }
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
    pretty: input.NODE_ENV !== 'production' && input.NODE_ENV !== 'test',
    dev: {
      prettyError: {
        snippet: false,
        stackDepth: 0,
        compact: true,
        detail: 'guidance',
      },
    },
  };
}

export function keepServerErrorEvents(ctx: TailSamplingContext): void {
  if ((ctx.status ?? 0) >= 500) {
    ctx.shouldKeep = true;
  }
}

/**
 * Write error / why / fix as flat wide-event siblings (screenshot-style tree).
 * Prefer this over logger.error(createError) so the console does not nest Why/Fix under a stack.
 */
export function applyFlatStructuredError(
  logger: {
    set: (fields: Record<string, unknown>) => void;
    setLevel?: (level: 'debug' | 'info' | 'warn' | 'error') => void;
  },
  error: Error | string,
  kind: 'process' | 'http' = 'process',
): void {
  const structured = toServerFaultError(error, kind) as Error & {
    why?: string;
    fix?: string;
  };
  logger.setLevel?.('error');
  logger.set({
    error: structured.message,
    why: structured.why,
    fix: structured.fix,
  });
}

/**
 * Emit a force-kept server fault (status 500) outside HTTP middleware —
 * process crashes, worker job failures, readiness checks excluded from HTTP logs.
 * Pretty console tree uses flat siblings: path / error / why / fix (no nested stack).
 */
export function emitServerFault(
  error: Error | string,
  fields?: Record<string, unknown>,
): void {
  const faultLog = createRequestLogger({});
  const structured = toServerFaultError(error, 'process') as Error & {
    why?: string;
    fix?: string;
  };
  faultLog.setLevel('error');
  faultLog.set({
    ...(fields ?? {}),
    error: structured.message,
    why: structured.why,
    fix: structured.fix,
    status: 500,
  });
  faultLog.emit();
}

function isStructuredEvlogError(
  error: Error,
): error is Error & { why?: string; fix?: string } {
  return (
    error.name === 'EvlogError' ||
    (typeof (error as { why?: unknown }).why === 'string' &&
      typeof (error as { fix?: unknown }).fix === 'string')
  );
}

function portFromAddrInUse(message: string): string | undefined {
  const match =
    message.match(/:::(\d+)/) ??
    message.match(/:(\d+)\s*$/) ??
    message.match(/port\s+(\d+)/i);
  return match?.[1];
}

/**
 * Normalize faults into createError({ message, why, fix }).
 */
export function toServerFaultError(
  error: Error | string,
  kind: 'process' | 'http' = 'process',
): Error {
  if (typeof error === 'string') {
    return createError({
      message: error,
      status: 500,
      why:
        kind === 'http'
          ? 'A server fault was reported without an Error instance during the request'
          : 'A server fault was reported without an Error instance',
      fix: 'Inspect the surrounding log fields and resolve the reported condition',
    });
  }

  if (isStructuredEvlogError(error)) {
    return error;
  }

  const code = (error as NodeJS.ErrnoException).code;

  if (code === 'EADDRINUSE') {
    const port = portFromAddrInUse(error.message) ?? 'PORT';
    return createError({
      message: error.message,
      status: 500,
      why: `Another process is already bound to port ${port}`,
      fix: `Stop the process using port ${port}, or set PORT in .env to a free port`,
      cause: error,
      internal: {
        code,
        syscall: (error as NodeJS.ErrnoException).syscall,
        port,
      },
    });
  }

  if (code) {
    return createError({
      message: error.message,
      status: 500,
      why: `Operating-system error ${code} during server bootstrap or runtime`,
      fix: 'Check system resources, permissions, and the stack attached to this event',
      cause: error,
      internal: {
        code,
        syscall: (error as NodeJS.ErrnoException).syscall,
      },
    });
  }

  return createError({
    message: error.message,
    status: 500,
    why:
      kind === 'http'
        ? 'An unexpected server error occurred while handling the request'
        : 'An unexpected server fault occurred outside the HTTP request pipeline',
    fix:
      kind === 'http'
        ? 'Check the request path and handler, then address the root cause'
        : 'Use the stack and surrounding context fields to locate and fix the failure',
    cause: error,
  });
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
      setLevel: (level) => {
        requestLog.setLevel?.(level);
      },
      error: (error) => {
        applyFlatStructuredError(requestLog, error, 'http');
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
        emitServerFault(error);
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
