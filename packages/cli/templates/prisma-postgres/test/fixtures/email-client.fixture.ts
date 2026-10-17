/** EMAIL_PROVIDER config snapshots for email-client.factory specs. */
export const emailClientConfigFixtures = {
  test: { EMAIL_PROVIDER: 'test' },
  google: {
    EMAIL_PROVIDER: 'google',
    EMAIL_ADDRESS: 'user@gmail.com',
    EMAIL_PASSWORD: 'secret',
  },
  smtp: {
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
  },
  resend: {
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_test_key',
  },
  invalidProvider: { EMAIL_PROVIDER: 'mailgun' },
} as const;
