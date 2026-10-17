import { ConfigService } from '@nestjs/config';
import moment from 'moment-timezone';

export const DEFAULT_TIMEZONE = 'Africa/Lagos';

export interface PlatformContext {
  platformName: string;
  platformSupport: string;
  platformUrl: string;
  logoUrl: string | null;
  brandColor: string;
  timezone: string;
  year: number;
  [key: string]: unknown;
}

export function resolveTimezone(raw?: string | null): string {
  const timezone = raw?.trim() || DEFAULT_TIMEZONE;
  if (!moment.tz.zone(timezone)) {
    throw new Error(`TIMEZONE must be a valid IANA name (got "${timezone}")`);
  }
  return timezone;
}

export function currentYearInTimezone(timezone: string): number {
  return Number.parseInt(moment.tz(timezone).format('YYYY'), 10);
}

export function buildPlatformContext(
  configService: ConfigService,
  overrides: Record<string, unknown> = {},
): PlatformContext {
  const timezone = resolveTimezone(configService.get<string>('TIMEZONE'));
  return {
    platformName: configService.get<string>('PLATFORM_NAME') ?? '',
    platformSupport: configService.get<string>('PLATFORM_SUPPORT') ?? '',
    platformUrl: configService.get<string>('PLATFORM_URL') ?? '',
    logoUrl: configService.get<string>('PLATFORM_LOGO_URL') ?? null,
    brandColor: configService.get<string>('COLOR_CODE') ?? '#635BFF',
    timezone,
    year: currentYearInTimezone(timezone),
    ...overrides,
  };
}

export function buildMailFromField(configService: ConfigService): string {
  const platformName = configService.get<string>('PLATFORM_NAME')?.trim();
  // Prefer EMAIL_FROM for deliverability; avoid using noreply@ as the visible From.
  const fromAddress =
    configService.get<string>('EMAIL_FROM')?.trim() ||
    configService.get<string>('PLATFORM_SUPPORT')?.trim() ||
    '';

  if (!fromAddress) {
    throw new Error(
      'EMAIL_FROM or PLATFORM_SUPPORT is required for email configuration',
    );
  }

  return platformName ? `${platformName} <${fromAddress}>` : fromAddress;
}

/** Reply-To: EMAIL_REPLY_TO if set, otherwise PLATFORM_SUPPORT. */
export function buildMailReplyTo(configService: ConfigService): string {
  const replyTo =
    configService.get<string>('EMAIL_REPLY_TO')?.trim() ||
    configService.get<string>('PLATFORM_SUPPORT')?.trim() ||
    '';

  if (!replyTo) {
    throw new Error(
      'EMAIL_REPLY_TO or PLATFORM_SUPPORT is required for email configuration',
    );
  }

  return replyTo;
}
