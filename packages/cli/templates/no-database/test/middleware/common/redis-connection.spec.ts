import { ConfigService } from '@nestjs/config';

import { redisConnectionConfig, redisUrlFixtures } from '../../fixtures';
import { getRedisConnectionOptions, wrapRedisError } from 'src/middleware';

function createConfigService(value: string): ConfigService {
  return {
    get: jest.fn(() => value),
  } as unknown as ConfigService;
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

  it('returns lazyConnect config when REDIS_URL is set', () => {
    expect(
      getRedisConnectionOptions(createConfigService(redisUrlFixtures.valid)),
    ).toEqual(redisConnectionConfig);
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
