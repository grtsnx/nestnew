import { ConfigService } from '@nestjs/config';
import { createRequestLogger } from 'evlog';
import type { RedisOptions } from 'ioredis';

import { emitServerFault } from '../config/evlog.factory';

export const REDIS_KEEPALIVE_MS = 10_000;

const REDIS_IDLE_DISCONNECT_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'EPIPE',
]);

export type RedisErrorSource = 'queue' | 'worker' | 'client';

export interface RedisConnectionConfig {
  url: string;
  lazyConnect: true;
  maxRetriesPerRequest: null;
  keepAlive: number;
}

export interface BullmqRedisConnection {
  url: string;
  maxRetriesPerRequest: null;
  keepAlive: number;
}

export function getRedisConnectionOptions(
  configService: ConfigService,
): RedisConnectionConfig | null {
  const url = configService.get<string>('REDIS_URL')?.trim() ?? '';
  if (!url) {
    return null;
  }

  return {
    url,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    keepAlive: REDIS_KEEPALIVE_MS,
  };
}

export function toRedisOptions(config: RedisConnectionConfig): RedisOptions {
  return {
    lazyConnect: config.lazyConnect,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    keepAlive: config.keepAlive,
  };
}

export function toBullmqConnection(
  config: RedisConnectionConfig,
): BullmqRedisConnection {
  return {
    url: config.url,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    keepAlive: config.keepAlive,
  };
}

export function wrapRedisError(operation: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`Error ${operation} in Redis: ${message}`, { cause: error });
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isIdleDisconnect(error: Error): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === 'string' && REDIS_IDLE_DISCONNECT_CODES.has(code);
}

export function attachRedisErrorListener(
  emitter: { on(event: 'error', listener: (error: Error) => void): unknown },
  source: RedisErrorSource,
): void {
  emitter.on('error', (error) => {
    const err = asError(error);
    if (isIdleDisconnect(err)) {
      const code = (err as NodeJS.ErrnoException).code;
      const syscall = (err as NodeJS.ErrnoException).syscall;
      const log = createRequestLogger({});
      log.setLevel('warn');
      log.set({
        redis: {
          source,
          event: 'disconnect',
          ...(code ? { code } : {}),
          ...(syscall ? { syscall } : {}),
        },
        error: err.message,
      });
      log.emit({ _forceKeep: true });
      return;
    }

    emitServerFault(err, { redis: { source, event: 'error' } });
  });
}
