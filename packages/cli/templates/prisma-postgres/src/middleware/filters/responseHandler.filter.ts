import { HttpException, HttpStatus } from '@nestjs/common';

const CLIENT_MESSAGE_MIN_WORDS = 2;
const CLIENT_MESSAGE_MAX_WORDS = 6;

const COMPROMISED_PASSWORD_MESSAGE = 'Choose different password';
const AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE = 'Invalid login details';
const AUTH_AMBIGUOUS_SIGNUP_MESSAGE = 'Unable to create account';

const AUTH_CODE_MESSAGES: Readonly<Record<string, string>> = {
  COMPROMISED_PASSWORD: COMPROMISED_PASSWORD_MESSAGE,
  USER_ALREADY_EXISTS: AUTH_AMBIGUOUS_SIGNUP_MESSAGE,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: AUTH_AMBIGUOUS_SIGNUP_MESSAGE,
  INVALID_EMAIL_OR_PASSWORD: AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE,
  INVALID_USERNAME_OR_PASSWORD: AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE,
  INVALID_PASSWORD: AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE,
  INVALID_EMAIL: AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE,
  INVALID_USERNAME: AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE,
  USER_NOT_FOUND: AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE,
  CREDENTIAL_ACCOUNT_NOT_FOUND: AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE,
  USER_EMAIL_NOT_FOUND: AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE,
  EMAIL_NOT_VERIFIED: 'Verification OTP sent',
  TOO_MANY_REQUESTS: 'Too many requests',
  INVALID_TOKEN: 'Invalid token',
  EXPIRED_TOKEN: 'Token expired',
  SESSION_EXPIRED: 'Session expired',
  PASSWORD_TOO_SHORT: 'Password too short',
  PASSWORD_TOO_LONG: 'Password too long',
  STALE_ACCOUNT: 'Inactive account contact support',
  INVALID_OTP: 'Invalid verification code',
  OTP_EXPIRED: 'Verification code expired',
  EMAIL_ALREADY_VERIFIED: 'Email already verified',
};

const AUTH_PHRASE_MESSAGES: ReadonlyArray<readonly [RegExp, string]> = [
  [/without device identification/i, 'Device identification required'],
  [
    /account creation is not allowed from this device/i,
    'Too many accounts from this device',
  ],
  [/account creation is not allowed/i, 'Account creation not allowed'],
  [/suspicious location change/i, 'Suspicious location change'],
  [/user already exists/i, AUTH_AMBIGUOUS_SIGNUP_MESSAGE],
  [/invalid email or password/i, AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE],
  [/invalid username or password/i, AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE],
  [/invalid email/i, AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE],
  [/invalid password/i, AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE],
  [/invalid username/i, AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE],
  [/user not found/i, AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE],
  [/credential account not found/i, AUTH_AMBIGUOUS_CREDENTIAL_MESSAGE],
  [/inactive for an extended period/i, 'Inactive account contact support'],
];

const STATUS_NAMES = Object.entries(HttpStatus).reduce<Record<number, string>>(
  (acc, [key, value]) => {
    if (typeof value === 'number') {
      acc[value] = key;
    }
    return acc;
  },
  {},
);

function getStatusType(statusCode: number): string {
  return STATUS_NAMES[statusCode] ?? 'UNKNOWN';
}

function statusFallback(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) {
    return 'Request succeeded';
  }
  if (statusCode === 401) {
    return 'Not authorized';
  }
  if (statusCode === 403) {
    return 'Access denied';
  }
  if (statusCode === 404) {
    return 'Not found';
  }
  if (statusCode === 429) {
    return 'Too many requests';
  }
  if (statusCode === 400 || statusCode === 422) {
    return 'Request invalid';
  }
  return 'Request failed';
}

function mappedPhrase(message: string): string | undefined {
  for (const [pattern, mapped] of AUTH_PHRASE_MESSAGES) {
    if (pattern.test(message)) {
      return mapped;
    }
  }
  return undefined;
}

function envelopeCode(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const code = (data as Record<string, unknown>).code;
  return typeof code === 'string' ? code : undefined;
}

function messageWords(message: string): string[] {
  return message.trim().split(/\s+/).filter(Boolean);
}

/** Clamp any client envelope message to 2–6 complete words. Never slice mid-sentence. */
export function toClientMessage(
  message: string,
  data?: unknown,
  statusCode = 400,
): string {
  const code = envelopeCode(data);
  if (code) {
    const mapped = AUTH_CODE_MESSAGES[code];
    if (mapped) {
      return mapped;
    }
  }
  if (/data breaches/i.test(message) || /compromised password/i.test(message)) {
    return COMPROMISED_PASSWORD_MESSAGE;
  }
  const phrase = mappedPhrase(message);
  if (phrase) {
    return phrase;
  }

  const words = messageWords(message);
  if (words.length === 0) {
    return statusFallback(statusCode);
  }
  if (words.length < CLIENT_MESSAGE_MIN_WORDS) {
    const rawWord = words[0];
    if (!rawWord) {
      return statusFallback(statusCode);
    }
    const word = rawWord.replace(/[^\p{L}\p{N}-]/gu, '');
    if (!word) {
      return statusFallback(statusCode);
    }
    if (/^ok$/i.test(word) && statusCode < 300) {
      return 'Request succeeded';
    }
    if (/^hello$/i.test(word)) {
      return 'Hello World';
    }
    if (/^unauthorized$/i.test(word)) {
      return 'Not authorized';
    }
    if (/^forbidden$/i.test(word)) {
      return 'Access denied';
    }
    return statusCode >= 200 && statusCode < 300
      ? `${word} succeeded`
      : `${word} failed`;
  }
  if (words.length > CLIENT_MESSAGE_MAX_WORDS) {
    return statusFallback(statusCode);
  }
  return words.join(' ');
}

export class handleResponse extends HttpException {
  public message: string;

  constructor(
    public statusCode: number,
    message: string,
    public data?: unknown,
  ) {
    const clientMessage = toClientMessage(message, data, statusCode);
    const response: Record<string, unknown> = {
      statusCode,
      statusType: getStatusType(statusCode),
      message: clientMessage,
    };

    if (data !== undefined) {
      response.data = data;
    }

    super(response, statusCode);
    this.message = clientMessage;
  }

  getResponse(): Record<string, unknown> {
    const response: Record<string, unknown> = {
      statusCode: this.getStatus(),
      statusType: getStatusType(this.getStatus()),
      message: this.message,
    };

    if (this.data !== undefined) {
      response.data = this.data;
    }

    return response;
  }

  getStatus(): number {
    return this.statusCode;
  }
}
