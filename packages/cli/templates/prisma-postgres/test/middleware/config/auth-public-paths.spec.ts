import {
  AUTH_BASE_PATH,
  isAuthInfraHttpPath,
  isAuthInfraRelativePath,
  isEmailVerificationOtpSend,
} from 'src/middleware/config/auth-public-paths';

describe('isAuthInfraHttpPath', () => {
  it('matches Better Auth Infra dashboard and event routes', () => {
    expect(isAuthInfraHttpPath(`${AUTH_BASE_PATH}/dash/config`)).toBe(true);
    expect(isAuthInfraHttpPath(`${AUTH_BASE_PATH}/dash/list-users`)).toBe(true);
    expect(isAuthInfraHttpPath(`${AUTH_BASE_PATH}/events/audit-logs`)).toBe(
      true,
    );
  });

  it('does not match public client auth routes', () => {
    expect(isAuthInfraHttpPath(`${AUTH_BASE_PATH}/sign-in/email`)).toBe(false);
    expect(isAuthInfraHttpPath(`${AUTH_BASE_PATH}/ok`)).toBe(false);
  });
});

describe('isEmailVerificationOtpSend', () => {
  it('matches only signup verification OTP sends', () => {
    expect(
      isEmailVerificationOtpSend(
        '/email-otp/send-verification-otp',
        'email-verification',
      ),
    ).toBe(true);
    expect(
      isEmailVerificationOtpSend(
        '/email-otp/send-verification-otp',
        'forget-password',
      ),
    ).toBe(false);
    expect(
      isEmailVerificationOtpSend('/sign-in/email', 'email-verification'),
    ).toBe(false);
  });
});

describe('isAuthInfraRelativePath', () => {
  it('matches Better Auth handler paths used by after hooks', () => {
    expect(isAuthInfraRelativePath('/dash/config')).toBe(true);
    expect(isAuthInfraRelativePath('/events/audit-logs')).toBe(true);
    expect(isAuthInfraRelativePath('/sign-in/email')).toBe(false);
  });
});
