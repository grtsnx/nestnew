import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

export interface RedisConnectionConfig {
  url: string;
  lazyConnect: true;
  maxRetriesPerRequest: null;
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
  };
}

export function toRedisOptions(config: RedisConnectionConfig): RedisOptions {
  return {
    lazyConnect: config.lazyConnect,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
  };
}

export function wrapRedisError(operation: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`Error ${operation} in Redis: ${message}`, { cause: error });
}
