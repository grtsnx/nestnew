/** Redis URL edge cases for getRedisConnectionOptions. */
export const redisUrlFixtures = {
  unset: '',
  whitespace: '   ',
  valid: 'redis://localhost:6379',
} as const;

export const redisConnectionConfig = {
  url: redisUrlFixtures.valid,
  lazyConnect: true,
  maxRetriesPerRequest: null,
} as const;

/** Sample keys/patterns for RedisService specs. */
export const redisKeyFixtures = {
  sampleKey: 'key',
  missingKey: 'missing',
  lockKey: 'lock',
  emptyPattern: 'none:*',
  userPattern: 'user:*',
  sampleValue: { id: 1 },
  sampleValueNoTtl: { id: 2 },
} as const;
