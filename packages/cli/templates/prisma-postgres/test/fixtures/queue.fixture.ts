import {
  sendEmailJobPayload,
  welcomeEmailRecipient,
  welcomeEmailSubject,
} from './email.fixture';

/** Standard BullMQ job name for transactional email. */
export const emailSendJobName = 'email.send';

/** Custom job name edge case for generic enqueue. */
export const customQueueJobName = 'custom.job';

export const customQueueJobPayload = {
  to: welcomeEmailRecipient,
  subject: welcomeEmailSubject,
  template: 'welcome',
} as const;

export { sendEmailJobPayload };
