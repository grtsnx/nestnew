import type { SendEmailJobPayload, WelcomeEmailContext } from 'src/lib';

/** Primary recipient used across email and queue specs. */
export const welcomeEmailRecipient = 'alex@example.com';

/** Multi-recipient edge case for sendEmail. */
export const multiEmailRecipients = ['a@example.com', 'b@example.com'] as const;

export const welcomeEmailSubject = 'Welcome to TestPlatform';

/** Full welcome context with explicit ctaUrl. */
export const welcomeEmailContext: WelcomeEmailContext = {
  firstName: 'Alex',
  ctaUrl: 'https://app.example.com/dashboard',
};

/** Welcome context without ctaUrl — expects PLATFORM_URL fallback. */
export const welcomeEmailContextNoCta: WelcomeEmailContext = {
  firstName: 'Alex',
};

/** Platform env values merged into every email template context. */
export const platformEmailContext = {
  platformName: 'TestPlatform',
  platformSupport: 'noreply@test.local',
  platformUrl: 'https://app.example.com',
  logoUrl: null,
  brandColor: '#635BFF',
  year: 2026,
};

/** BullMQ email.send job payload (sync fields + optional context). */
export const sendEmailJobPayload: SendEmailJobPayload = {
  to: welcomeEmailRecipient,
  subject: welcomeEmailSubject,
  template: 'welcome',
  context: welcomeEmailContext,
};

/** Processor handler payload (minimal shape). */
export const processorEmailJobPayload = {
  to: 'user@example.com',
  subject: 'Welcome',
  template: 'welcome',
  context: { firstName: 'Alex' },
};

/** Unknown job name — processor should ignore. */
export const unknownQueueJobName = 'email.unknown';
