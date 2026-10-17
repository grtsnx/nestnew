import { ConfigService } from '@nestjs/config';

export const EMAIL_CLIENT = Symbol('EMAIL_CLIENT');

export type EmailProvider = 'test' | 'google' | 'smtp' | 'resend';

export interface EmailClient {
  send(message: {
    from: string;
    to: string | string[];
    subject: string;
    html: string;
    text: string;
    replyTo?: string | string[];
  }): Promise<{ adapter?: string; provider?: string; id?: string }>;
}

const clientDefaults = {
  telemetry: false,
  retry: { maxAttempts: 2 },
} as const;

export function getEmailProvider(configService: ConfigService): EmailProvider {
  const provider = configService.get<string>('EMAIL_PROVIDER') ?? 'test';
  if (
    provider === 'google' ||
    provider === 'smtp' ||
    provider === 'test' ||
    provider === 'resend'
  ) {
    return provider;
  }
  throw new Error(
    `EMAIL_PROVIDER must be one of: google, smtp, test, resend (received "${provider}")`,
  );
}

export async function createEmailClientFromConfig(
  configService: ConfigService,
): Promise<EmailClient> {
  const provider = getEmailProvider(configService);
  const { createEmailClient } = await import('@opencoredev/email-sdk');

  if (provider === 'test') {
    const { memoryAdapter } = await import('@opencoredev/email-sdk/testing');
    return createEmailClient({
      adapters: [memoryAdapter()],
      ...clientDefaults,
    });
  }

  if (provider === 'resend') {
    const { resend } = await import('@opencoredev/email-sdk/resend');
    return createEmailClient({
      adapters: [
        resend({
          apiKey: configService.get<string>('RESEND_API_KEY') ?? '',
        }),
      ],
      ...clientDefaults,
    });
  }

  if (provider === 'google') {
    const { smtp } = await import('@opencoredev/email-sdk/smtp');
    return createEmailClient({
      adapters: [
        smtp({
          name: 'google',
          host: 'smtp.gmail.com',
          port: 587,
          auth: {
            user: configService.get<string>('EMAIL_ADDRESS') ?? '',
            pass: configService.get<string>('EMAIL_PASSWORD') ?? '',
          },
        }),
      ],
      ...clientDefaults,
    });
  }

  const { smtp } = await import('@opencoredev/email-sdk/smtp');
  return createEmailClient({
    adapters: [
      smtp({
        host: configService.get<string>('SMTP_HOST') ?? '',
        port: 587,
        auth: {
          user: configService.get<string>('SMTP_USER') ?? '',
          pass: configService.get<string>('SMTP_PASS') ?? '',
        },
      }),
    ],
    ...clientDefaults,
  });
}
