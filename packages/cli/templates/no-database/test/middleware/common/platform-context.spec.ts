import { ConfigService } from '@nestjs/config';

import {
  platformContextDefaults,
  platformContextOverrides,
  platformEnvFixtures,
} from '../../fixtures';
import { buildMailFromField, buildPlatformContext } from 'src/middleware';

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
    expect(context.year).toBe(new Date().getFullYear());
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
    ).toThrow('PLATFORM_SUPPORT environment variable is required');
  });
});
