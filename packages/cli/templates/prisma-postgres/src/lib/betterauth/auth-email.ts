/**
 * Bridge Better Auth (module-level) to Nest SendMailsService.
 * AuthModule registers the mailer on boot; until then sends are no-ops.
 */

import { createRequestLogger } from 'evlog';

export type AuthOtpType =
  'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

export type AuthMailer = {
  sendVerificationOtp: (args: {
    email: string;
    otp: string;
    type: AuthOtpType;
  }) => Promise<void>;
  sendPasswordReset: (args: {
    email: string;
    url: string;
    name?: string | null;
  }) => Promise<void>;
};

let mailer: AuthMailer | null = null;

export function setAuthMailer(next: AuthMailer): void {
  mailer = next;
}

function warnMailerMissing(template: string): void {
  const log = createRequestLogger();
  log.set({ email: { template, toCount: 1 }, status: 500 });
  log.error(new Error('Auth mailer not registered'));
  log.emit();
}

export async function sendAuthVerificationOtp(args: {
  email: string;
  otp: string;
  type: AuthOtpType;
}): Promise<void> {
  // Password reset uses a link via sendResetPassword — never OTP.
  if (args.type === 'forget-password') {
    return;
  }
  if (!mailer) {
    warnMailerMissing('verify-otp');
    return;
  }
  await mailer.sendVerificationOtp(args);
}

export async function sendAuthPasswordReset(args: {
  email: string;
  url: string;
  name?: string | null;
}): Promise<void> {
  if (!mailer) {
    warnMailerMissing('reset-password');
    return;
  }
  await mailer.sendPasswordReset(args);
}
