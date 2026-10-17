import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  multiEmailRecipients,
  platformEmailContext,
  sendEmailJobPayload,
  welcomeEmailContext,
  welcomeEmailContextNoCta,
  welcomeEmailRecipient,
  welcomeEmailSubject,
} from '../../fixtures';
import { SendMailsService } from 'src/lib';
import { EMAIL_CLIENT, QueueService, type EmailClient } from 'src/middleware';

jest.mock('evlog/nestjs', () => ({
  useLogger: () => ({
    set: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}));

describe('SendMailsService', () => {
  let service: SendMailsService;
  let emailClient: { send: jest.MockedFunction<EmailClient['send']> };
  let queueService: { enqueueEmailSend: jest.Mock };

  beforeEach(async () => {
    emailClient = {
      send: jest.fn().mockResolvedValue({
        adapter: 'memory',
      }) as jest.MockedFunction<EmailClient['send']>,
    };
    queueService = { enqueueEmailSend: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendMailsService,
        {
          provide: EMAIL_CLIENT,
          useValue: emailClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                PLATFORM_NAME: platformEmailContext.platformName,
                PLATFORM_SUPPORT: platformEmailContext.platformSupport,
                PLATFORM_URL: platformEmailContext.platformUrl,
                PLATFORM_LOGO_URL: '',
                COLOR_CODE: platformEmailContext.brandColor,
              };
              return values[key];
            }),
          },
        },
        {
          provide: QueueService,
          useValue: queueService,
        },
      ],
    }).compile();

    service = module.get(SendMailsService);
  });

  it('sendEmail renders welcome.hbs and sends html', async () => {
    await expect(
      service.sendEmail(
        welcomeEmailRecipient,
        welcomeEmailSubject,
        'welcome',
        welcomeEmailContext,
      ),
    ).resolves.toBe(true);

    expect(emailClient.send).toHaveBeenCalledTimes(1);
    const payload = emailClient.send.mock.calls[0]?.[0] as {
      to: string;
      subject: string;
      from: string;
      html: string;
      text: string;
    };

    expect(payload.to).toBe(welcomeEmailRecipient);
    expect(payload.subject).toBe(welcomeEmailSubject);
    expect(payload.from).toBe(
      `${platformEmailContext.platformName} <${platformEmailContext.platformSupport}>`,
    );
    expect(payload.html).toContain(`Hi`);
    expect(payload.html).toContain(welcomeEmailContext.firstName);
    expect(payload.html).toContain(platformEmailContext.platformName);
    expect(payload.html).toContain(welcomeEmailContext.ctaUrl);
    expect(payload.html).not.toContain('{{firstName}}');
    expect(payload.text).toContain(welcomeEmailContext.firstName);
    expect(payload.text).not.toContain('<html');
  });

  it('sendWelcomeEmail uses welcome template and default subject', async () => {
    await service.sendWelcomeEmail(welcomeEmailRecipient, welcomeEmailContext);

    expect(emailClient.send).toHaveBeenCalledTimes(1);
    const payload = emailClient.send.mock.calls[0]?.[0] as {
      subject: string;
      html: string;
    };
    expect(payload.subject).toBe(
      `Welcome to ${platformEmailContext.platformName}`,
    );
    expect(payload.html).toContain(welcomeEmailContext.firstName);
  });

  it('sendEmail throws InternalServerErrorException on timeout', async () => {
    emailClient.send.mockRejectedValue({ code: 'ETIMEDOUT' });

    await expect(
      service.sendEmail(
        welcomeEmailRecipient,
        welcomeEmailSubject,
        'welcome',
        welcomeEmailContext,
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('sendEmail throws InternalServerErrorException on generic failure', async () => {
    emailClient.send.mockRejectedValue(new Error('SMTP failure'));

    await expect(
      service.sendEmail(
        welcomeEmailRecipient,
        welcomeEmailSubject,
        'welcome',
        welcomeEmailContext,
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('sendEmail renders verify-otp.hbs with the code', async () => {
    await expect(
      service.sendEmail(
        welcomeEmailRecipient,
        'Your TestPlatform verification code',
        'verify-otp',
        { otp: '482916', purpose: 'verify your email' },
      ),
    ).resolves.toBe(true);

    const payload = emailClient.send.mock.calls[0]?.[0] as {
      html: string;
      text: string;
      subject: string;
    };
    expect(payload.html).toContain('482916');
    expect(payload.html).toContain('verify your email');
    expect(payload.html).not.toContain('{{otp}}');
    expect(payload.text).toContain('482916');
  });

  it('sendEmail renders reset-password.hbs with the link', async () => {
    const resetUrl = 'https://app.example.com/reset?token=abc';
    await expect(
      service.sendEmail(
        welcomeEmailRecipient,
        'Reset your TestPlatform password',
        'reset-password',
        { resetUrl, firstName: 'Alex' },
      ),
    ).resolves.toBe(true);

    const payload = emailClient.send.mock.calls[0]?.[0] as { html: string };
    expect(payload.html).toContain(resetUrl);
    expect(payload.html).toContain('Alex');
    expect(payload.html).not.toContain('{{resetUrl}}');
  });

  it('sendEmail rejects unknown templates before sending', async () => {
    await expect(
      service.sendEmail(
        welcomeEmailRecipient,
        welcomeEmailSubject,
        'does-not-exist',
        welcomeEmailContext,
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(emailClient.send).not.toHaveBeenCalled();
  });

  it('sendEmailAsync enqueues job with fixture payload', async () => {
    await expect(
      service.sendEmailAsync(
        sendEmailJobPayload.to,
        sendEmailJobPayload.subject,
        sendEmailJobPayload.template,
        sendEmailJobPayload.context,
      ),
    ).resolves.toBe(true);

    expect(queueService.enqueueEmailSend).toHaveBeenCalledWith(
      sendEmailJobPayload,
    );
  });

  it('sendEmailAsync returns false when enqueue fails', async () => {
    queueService.enqueueEmailSend.mockRejectedValue(new Error('queue down'));

    await expect(
      service.sendEmailAsync(
        welcomeEmailRecipient,
        welcomeEmailSubject,
        'welcome',
      ),
    ).resolves.toBe(false);
  });

  it('sendEmailAsync returns false when enqueue resolves false', async () => {
    queueService.enqueueEmailSend.mockResolvedValue(false);

    await expect(
      service.sendEmailAsync(
        welcomeEmailRecipient,
        welcomeEmailSubject,
        'welcome',
      ),
    ).resolves.toBe(false);
  });

  it('sendEmail supports multiple recipients', async () => {
    await service.sendEmail(
      [...multiEmailRecipients],
      welcomeEmailSubject,
      'welcome',
      welcomeEmailContext,
    );

    expect(emailClient.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: [...multiEmailRecipients] }),
    );
  });

  it('sendWelcomeEmail falls back to PLATFORM_URL when ctaUrl is omitted', async () => {
    await service.sendWelcomeEmail(
      welcomeEmailRecipient,
      welcomeEmailContextNoCta,
    );

    const payload = emailClient.send.mock.calls[0]?.[0] as { html: string };
    expect(payload.html).toContain(platformEmailContext.platformUrl);
  });
});
