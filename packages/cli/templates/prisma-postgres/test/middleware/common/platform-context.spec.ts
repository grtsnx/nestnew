import { ConfigService } from '@nestjs/config';

import {
  platformContextDefaults,
  platformContextOverrides,
  platformEnvFixtures,
} from '../../fixtures';
import {
  buildMailFromField,
  buildMailReplyTo,
  buildPlatformContext,
  currentYearInTimezone,
  DEFAULT_TIMEZONE,
  resolveTimezone,
} from 'src/middleware';

function createConfigService(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('buildPlatformContext', () => {
  it('uses env defaults when values are missing', () => {
    const context = buildPlatformContext(
      createConfigService(platformEnvFixtures.empty),
    );

    expect(context.platformName).toBe(platformContextDefaults.platformName);
    expect(context.platformSupport).toBe(
      platformContextDefaults.platformSupport,
    );
    expect(context.brandColor).toBe(platformContextDefaults.brandColor);
    expect(context.logoUrl).toBe(platformContextDefaults.logoUrl);
    expect(context.timezone).toBe(platformContextDefaults.timezone);
    expect(context.year).toBe(currentYearInTimezone(DEFAULT_TIMEZONE));
  });

  it('merges overrides on top of env values', () => {
    const context = buildPlatformContext(
      createConfigService(platformEnvFixtures.withNameAndColor),
      platformContextOverrides.withFirstName,
    );

    expect(context.platformName).toBe('TestPlatform');
    expect(context.firstName).toBe('Alex');
    expect(context.brandColor).toBe('#111111');
  });

  it('uses TIMEZONE from env when set', () => {
    const context = buildPlatformContext(
      createConfigService({ TIMEZONE: 'America/New_York' }),
    );

    expect(context.timezone).toBe('America/New_York');
    expect(context.year).toBe(currentYearInTimezone('America/New_York'));
  });
});

describe('resolveTimezone', () => {
  it('defaults to Africa/Lagos', () => {
    expect(resolveTimezone()).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone('  ')).toBe(DEFAULT_TIMEZONE);
  });

  it('rejects unknown IANA names', () => {
    expect(() => resolveTimezone('Not/AZone')).toThrow(
      'TIMEZONE must be a valid IANA name',
    );
  });
});

describe('buildMailFromField', () => {
  it('formats from field with platform name', () => {
    expect(
      buildMailFromField(createConfigService(platformEnvFixtures.mailFrom)),
    ).toBe('TestPlatform <noreply@test.local>');
  });

  it('returns support email only when platform name is empty', () => {
    expect(
      buildMailFromField(
        createConfigService(platformEnvFixtures.mailFromNoName),
      ),
    ).toBe('noreply@test.local');
  });

  it('throws when PLATFORM_SUPPORT is missing', () => {
    expect(() =>
      buildMailFromField(
        createConfigService(platformEnvFixtures.mailFromMissingSupport),
      ),
    ).toThrow('EMAIL_FROM or PLATFORM_SUPPORT is required');
  });

  it('prefers EMAIL_FROM over PLATFORM_SUPPORT', () => {
    expect(
      buildMailFromField(
        createConfigService({
          PLATFORM_NAME: 'TestPlatform',
          PLATFORM_SUPPORT: 'noreply@test.local',
          EMAIL_FROM: 'hello@test.local',
        }),
      ),
    ).toBe('TestPlatform <hello@test.local>');
  });
});

describe('buildMailReplyTo', () => {
  it('uses EMAIL_REPLY_TO when set', () => {
    expect(
      buildMailReplyTo(
        createConfigService({
          PLATFORM_SUPPORT: 'noreply@test.local',
          EMAIL_REPLY_TO: 'support@test.local',
        }),
      ),
    ).toBe('support@test.local');
  });

  it('falls back to PLATFORM_SUPPORT when EMAIL_REPLY_TO is unset', () => {
    expect(
      buildMailReplyTo(
        createConfigService({
          PLATFORM_SUPPORT: 'noreply@test.local',
        }),
      ),
    ).toBe('noreply@test.local');
  });
});
