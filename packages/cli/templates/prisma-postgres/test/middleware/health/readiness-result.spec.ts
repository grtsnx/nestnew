import { toReadinessChecks, toReadinessMessage } from 'src/middleware';

describe('readiness result', () => {
  it('maps a successful Terminus payload', () => {
    expect(
      toReadinessChecks({
        status: 'ok',
        info: { redis: { status: 'up' }, queue: { status: 'up' } },
        error: {},
        details: { redis: { status: 'up' }, queue: { status: 'up' } },
      }),
    ).toEqual({
      redis: { status: 'up' },
      queue: { status: 'up' },
    });
    expect(
      toReadinessMessage({
        redis: { status: 'up' },
        queue: { status: 'up' },
      }),
    ).toBe('Services ready');
  });

  it('collapses duplicated Terminus error and details into one check map', () => {
    const checks = toReadinessChecks({
      status: 'error',
      info: {},
      error: {
        redis: { status: 'down', message: 'REDIS_URL is unset' },
        queue: { status: 'down', message: 'REDIS_URL is unset' },
      },
      details: {
        redis: { status: 'down', message: 'REDIS_URL is unset' },
        queue: { status: 'down', message: 'REDIS_URL is unset' },
      },
    });

    expect(checks).toEqual({
      redis: { status: 'down', reason: 'REDIS_URL is unset' },
      queue: { status: 'down', reason: 'REDIS_URL is unset' },
    });
    expect(toReadinessMessage(checks)).toBe('Services unavailable');
  });

  it('maps HealthCheckError causes without inventing missing checks', () => {
    expect(
      toReadinessChecks({
        redis: { status: 'down', message: 'PING failed' },
      }),
    ).toEqual({
      redis: { status: 'down', reason: 'PING failed' },
    });
  });
});
