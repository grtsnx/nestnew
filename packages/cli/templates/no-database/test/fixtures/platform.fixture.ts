/** Platform context env snapshots for buildPlatformContext / buildMailFromField. */
export const platformEnvFixtures = {
  empty: {},
  withNameAndColor: {
    PLATFORM_NAME: 'TestPlatform',
    COLOR_CODE: '#000000',
  },
  mailFrom: {
    PLATFORM_NAME: 'TestPlatform',
    PLATFORM_SUPPORT: 'noreply@test.local',
  },
  mailFromNoName: {
    PLATFORM_NAME: '   ',
    PLATFORM_SUPPORT: 'noreply@test.local',
  },
  mailFromMissingSupport: {
    PLATFORM_NAME: 'TestPlatform',
  },
} as const;

export const platformContextOverrides = {
  withFirstName: { firstName: 'Alex', brandColor: '#111111' },
} as const;

export const platformContextDefaults = {
  platformName: '',
  platformSupport: '',
  brandColor: '#635BFF',
  logoUrl: null,
} as const;
