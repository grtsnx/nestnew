import { ConfigService } from '@nestjs/config';

export interface PlatformContext {
  platformName: string;
  platformSupport: string;
  platformUrl: string;
  logoUrl: string | null;
  brandColor: string;
  year: number;
  [key: string]: unknown;
}

export function buildPlatformContext(
  configService: ConfigService,
  overrides: Record<string, unknown> = {},
): PlatformContext {
  return {
    platformName: configService.get<string>('PLATFORM_NAME') ?? '',
    platformSupport: configService.get<string>('PLATFORM_SUPPORT') ?? '',
    platformUrl: configService.get<string>('PLATFORM_URL') ?? '',
    logoUrl: configService.get<string>('PLATFORM_LOGO_URL') ?? null,
    brandColor: configService.get<string>('COLOR_CODE') ?? '#635BFF',
    year: new Date().getFullYear(),
    ...overrides,
  };
}

export function buildMailFromField(configService: ConfigService): string {
  const platformName = configService.get<string>('PLATFORM_NAME')?.trim();
  const platformSupport =
    configService.get<string>('PLATFORM_SUPPORT')?.trim() ?? '';

  if (!platformSupport) {
    throw new Error(
      'PLATFORM_SUPPORT environment variable is required for email configuration',
    );
  }

  return platformName
    ? `${platformName} <${platformSupport}>`
    : platformSupport;
}
