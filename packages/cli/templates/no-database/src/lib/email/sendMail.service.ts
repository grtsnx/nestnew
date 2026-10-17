import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  EMAIL_CLIENT,
  buildMailFromField,
  buildPlatformContext,
  getRequestOrGlobalLogger,
  type EmailClient,
  type PlatformContext,
  QueueService,
} from 'src/middleware';
import { htmlToPlainText, renderEmailTemplate } from './render-template';

export type EmailTemplateContext = PlatformContext & Record<string, unknown>;

export interface WelcomeEmailContext {
  firstName: string;
  ctaUrl?: string;
  [key: string]: unknown;
}

export interface SendEmailJobPayload {
  to: string | string[];
  subject: string;
  template: string;
  context?: Record<string, unknown>;
}

@Injectable()
export class SendMailsService {
  constructor(
    @Inject(EMAIL_CLIENT) private readonly emailClient: EmailClient,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
  ) {}

  private getEmailContext(
    baseContext: Record<string, unknown> = {},
  ): EmailTemplateContext {
    return buildPlatformContext(this.configService, baseContext);
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    template: string,
    context?: Record<string, unknown>,
  ): Promise<boolean> {
    const logger = getRequestOrGlobalLogger();
    const toCount = Array.isArray(to) ? to.length : 1;
    logger.set({ email: { template, toCount } });

    const mergedContext = this.getEmailContext(context ?? {});

    try {
      const html = renderEmailTemplate(template, mergedContext);
      await this.emailClient.send({
        from: buildMailFromField(this.configService),
        to,
        subject,
        html,
        text: htmlToPlainText(html),
      });

      return true;
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        stack?: string;
        code?: string;
        adapter?: string;
      };
      logger.error(
        error instanceof Error
          ? error
          : new Error(err.message ?? 'unknown error'),
      );

      if (err.message?.startsWith('Unknown email template')) {
        throw new InternalServerErrorException(err.message);
      }

      if (err.code === 'ETIMEDOUT') {
        throw new InternalServerErrorException(
          'Connection timeout while sending email. Please try again later.',
        );
      }

      throw new InternalServerErrorException('Failed to send email.');
    }
  }

  async sendWelcomeEmail(
    to: string,
    context: WelcomeEmailContext,
  ): Promise<boolean> {
    const platformName =
      this.configService.get<string>('PLATFORM_NAME')?.trim() ?? '';
    const platformUrl = this.configService.get<string>('PLATFORM_URL') ?? '';
    const subject = platformName ? `Welcome to ${platformName}` : 'Welcome';

    return this.sendEmail(to, subject, 'welcome', {
      ...context,
      ctaUrl: context.ctaUrl ?? platformUrl,
    });
  }

  async sendEmailAsync(
    to: string | string[],
    subject: string,
    template: string,
    context?: Record<string, unknown>,
  ): Promise<boolean> {
    const logger = getRequestOrGlobalLogger();
    const toCount = Array.isArray(to) ? to.length : 1;
    logger.set({ email: { template, toCount } });

    const payload: SendEmailJobPayload = { to, subject, template, context };

    try {
      const enqueued = await this.queueService.enqueueEmailSend(payload);
      return enqueued;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}
