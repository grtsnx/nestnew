import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';

import {
  auth,
  SendMailsService,
  setAuthMailer,
  type AuthOtpType,
} from 'src/lib';
import {
  AUTH_BASE_PATH,
  createAuthEnvelopeMiddleware,
} from 'src/middleware';

@Injectable()
class AuthEmailBridge implements OnModuleInit {
  constructor(
    private readonly mail: SendMailsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const platformName =
      this.config.get<string>('PLATFORM_NAME')?.trim() || 'App';

    setAuthMailer({
      sendVerificationOtp: async ({ email, otp, type }) => {
        const purpose = otpPurpose(type);
        // Put the code in the subject so it is findable (and not buried in spam).
        const subject =
          type === 'email-verification'
            ? `Your ${platformName} code: ${otp}`
            : `Your ${platformName} sign-in code: ${otp}`;
        await this.dispatch(email, subject, 'verify-otp', {
          otp,
          purpose,
        });
      },
      sendPasswordReset: async ({ email, url, name }) => {
        const firstName =
          typeof name === 'string' && name.trim()
            ? name.trim().split(/\s+/)[0]
            : 'there';
        await this.dispatch(
          email,
          `Reset your ${platformName} password`,
          'reset-password',
          { resetUrl: url, firstName },
        );
      },
    });
  }

  /** Auth emails send immediately so OTP delivery does not depend on the queue. */
  private async dispatch(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    await this.mail.sendEmail(to, subject, template, context);
  }
}

function otpPurpose(type: AuthOtpType): string {
  switch (type) {
    case 'email-verification':
      return 'verify your email';
    case 'sign-in':
      return 'sign in';
    case 'change-email':
      return 'confirm your email change';
    default:
      return 'continue';
  }
}

@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth,
      disableGlobalAuthGuard: false,
      bodyParser: { rawBody: true },
      middleware: createAuthEnvelopeMiddleware(AUTH_BASE_PATH),
    }),
  ],
  providers: [AuthEmailBridge],
})
export class AuthModule {}
