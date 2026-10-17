import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import {
  attachRedisErrorListener,
  getRedisConnectionOptions,
  toRedisOptions,
  wrapRedisError,
} from 'src/middleware';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis | null;

  constructor(private readonly configService: ConfigService) {
    const connection = getRedisConnectionOptions(this.configService);
    this.redis = connection
      ? new Redis(connection.url, toRedisOptions(connection))
      : null;
    if (this.redis) {
      attachRedisErrorListener(this.redis, 'client');
    }
  }

  isEnabled(): boolean {
    return this.redis !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private client(): Redis {
    if (!this.redis) {
      throw new Error('Redis is not configured (REDIS_URL is unset)');
    }
    return this.redis;
  }

  async set(
    key: string,
    value: unknown,
    expireInSeconds?: number,
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (expireInSeconds) {
        await this.client().setex(key, expireInSeconds, serialized);
      } else {
        await this.client().set(key, serialized);
      }
    } catch (error) {
      wrapRedisError('saving data', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client().get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      wrapRedisError('getting data', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client().del(key);
    } catch (error) {
      wrapRedisError('deleting data', error);
    }
  }

  async increment(key: string): Promise<number> {
    try {
      return await this.client().incr(key);
    } catch (error) {
      wrapRedisError('incrementing key', error);
    }
  }

  async tryAcquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client().set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return false;
    }
  }

  async getByPattern<T>(pattern: string): Promise<Record<string, T | null>> {
    try {
      const keys: string[] = [];
      const stream = this.client().scanStream({ match: pattern, count: 100 });

      for await (const batch of stream) {
        const chunk = batch as string[];
        keys.push(...chunk);
      }

      const result: Record<string, T | null> = {};
      for (const key of keys) {
        result[key] = await this.get<T>(key);
      }

      return result;
    } catch (error) {
      wrapRedisError('getting data by pattern', error);
    }
  }
}
