import type { NextFunction, Request, Response } from 'express';

import {
  isAuthInfraHttpPath,
  isAuthSignInHttpPath,
} from 'src/middleware/config/auth-public-paths';
import {
  handleResponse,
  toClientMessage,
} from 'src/middleware/filters/responseHandler.filter';

const ENVELOPE_KEYS = ['statusCode', 'statusType', 'message'] as const;
const EMAIL_VERIFICATION_OTP_SENT_MESSAGE = 'Verification OTP sent';

const AUTH_INTERNAL_HTTP_SUFFIXES = [
  '/open-api/generate-schema',
  '/reference',
] as const;

function toBufferChunk(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }
  return Buffer.from(String(chunk));
}

export function isHandleResponseBody(
  body: unknown,
): body is Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }
  const obj = body as Record<string, unknown>;
  return ENVELOPE_KEYS.every(
    (key) => key in obj && typeof obj[key] !== 'undefined',
  );
}

function defaultMessage(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) {
    return 'Request succeeded';
  }
  if (statusCode === 400) return 'Bad Request';
  if (statusCode === 401) return 'Not authorized';
  if (statusCode === 403) return 'Access denied';
  if (statusCode === 404) return 'Not Found';
  if (statusCode === 422) return 'Unprocessable Entity';
  if (statusCode === 429) return 'Too Many Requests';
  if (statusCode >= 500) return 'Internal Server Error';
  return 'Request failed';
}

function envelopeCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const obj = body as Record<string, unknown>;
  if (typeof obj.code === 'string') {
    return obj.code;
  }
  if (
    obj.data &&
    typeof obj.data === 'object' &&
    !Array.isArray(obj.data) &&
    typeof (obj.data as Record<string, unknown>).code === 'string'
  ) {
    return (obj.data as Record<string, unknown>).code as string;
  }
  return undefined;
}

function isPendingEmailVerificationSignIn(
  statusCode: number,
  body: unknown,
  authPath?: string,
): boolean {
  if (statusCode !== 403 || !authPath || !isAuthSignInHttpPath(authPath)) {
    return false;
  }
  return envelopeCode(body) === 'EMAIL_NOT_VERIFIED';
}

function pendingEmailVerificationSignInEnvelope(): Record<string, unknown> {
  return new handleResponse(200, EMAIL_VERIFICATION_OTP_SENT_MESSAGE, {
    code: 'EMAIL_NOT_VERIFIED',
  }).getResponse();
}

/** Map a raw JSON body to the shared handleResponse envelope. */
export function toHandleResponseBody(
  statusCode: number,
  body: unknown,
  message?: string,
  authPath?: string,
): Record<string, unknown> {
  if (isPendingEmailVerificationSignIn(statusCode, body, authPath)) {
    return pendingEmailVerificationSignInEnvelope();
  }

  const resolvedMessage = message ?? defaultMessage(statusCode);
  if (isHandleResponseBody(body)) {
    const obj = body;
    const clientMessage = toClientMessage(
      typeof obj.message === 'string' ? obj.message : '',
      obj.data,
      statusCode,
    );
    if (clientMessage === obj.message) {
      return obj;
    }
    return { ...obj, message: clientMessage };
  }

  if (body === null || body === undefined) {
    return new handleResponse(statusCode, resolvedMessage).getResponse();
  }

  if (typeof body === 'object' && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    if (typeof obj.message === 'string' && statusCode >= 400) {
      const { message: errorMessage, ...rest } = obj;
      const data = Object.keys(rest).length > 0 ? rest : undefined;
      return new handleResponse(statusCode, errorMessage, data).getResponse();
    }
    return new handleResponse(statusCode, resolvedMessage, obj).getResponse();
  }

  return new handleResponse(statusCode, resolvedMessage, body).getResponse();
}

function authApiErrorStatus(error: {
  statusCode?: number;
  status?: string;
}): number {
  if (typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  switch (error.status) {
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'BAD_REQUEST':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'UNPROCESSABLE_ENTITY':
      return 422;
    case 'TOO_MANY_REQUESTS':
      return 429;
    default:
      return 500;
  }
}

function authApiErrorPayload(error: {
  message?: string;
  body?: unknown;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    message: error.message ?? 'Request failed',
  };
  if (
    error.body &&
    typeof error.body === 'object' &&
    !Array.isArray(error.body)
  ) {
    Object.assign(payload, error.body as Record<string, unknown>);
  }
  return payload;
}

/** Normalize Better Auth / Nest failures to handleResponse for service catch blocks. */
export function rethrowAsHandleResponse(error: unknown): never {
  if (error instanceof handleResponse) {
    throw error;
  }
  const err = error as {
    statusCode?: number;
    message?: string;
    status?: string;
    body?: unknown;
  };
  const status = authApiErrorStatus(err);
  const envelope = toHandleResponseBody(status, authApiErrorPayload(err));
  throw new handleResponse(
    envelope.statusCode as number,
    envelope.message as string,
    'data' in envelope ? envelope.data : undefined,
  );
}

/** Wrap a raw JSON auth response body when it is not already enveloped. */
export function envelopeJsonResponse(
  statusCode: number,
  rawBody: string,
  contentType?: string,
  authPath?: string,
): { statusCode: number; body: string } {
  if (contentType && !contentType.toLowerCase().includes('json')) {
    return { statusCode, body: rawBody };
  }
  if (!rawBody.trim()) {
    return { statusCode, body: rawBody };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { statusCode, body: rawBody };
  }

  if (isHandleResponseBody(parsed)) {
    if (isPendingEmailVerificationSignIn(statusCode, parsed, authPath)) {
      const envelope = pendingEmailVerificationSignInEnvelope();
      return { statusCode: 200, body: JSON.stringify(envelope) };
    }
    return { statusCode, body: rawBody };
  }

  const envelope = toHandleResponseBody(statusCode, parsed, undefined, authPath);
  const resolvedStatus =
    typeof envelope.statusCode === 'number' ? envelope.statusCode : statusCode;
  return { statusCode: resolvedStatus, body: JSON.stringify(envelope) };
}

/**
 * Buffer Better Auth HTTP responses and wrap raw JSON errors/success payloads
 * in the shared handleResponse envelope. Before-hook APIErrors skip after hooks
 * and would otherwise reach clients as `{ message, code }` only.
 */
export function createAuthEnvelopeMiddleware(basePath: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const pathOnly = (req.url.split('?')[0] ?? '').replace(/\/$/, '') || '/';
    if (!pathOnly.startsWith(basePath)) {
      next();
      return;
    }
    if (
      AUTH_INTERNAL_HTTP_SUFFIXES.some((suffix) => pathOnly.endsWith(suffix)) ||
      isAuthInfraHttpPath(pathOnly, basePath)
    ) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = function (
      chunk: unknown,
      encodingOrCb?: BufferEncoding | ((err?: Error) => void),
      cb?: (err?: Error) => void,
    ): boolean {
      if (chunk) {
        chunks.push(toBufferChunk(chunk));
      }
      if (typeof encodingOrCb === 'function') {
        process.nextTick(encodingOrCb);
      } else if (cb) {
        process.nextTick(cb);
      }
      return true;
    } as typeof res.write;

    res.end = ((chunk?: unknown) => {
      if (chunk) {
        chunks.push(toBufferChunk(chunk));
      }

      const rawBody = Buffer.concat(chunks).toString('utf8');
      const contentTypeHeader = res.getHeader('content-type');
      const contentType =
        typeof contentTypeHeader === 'string'
          ? contentTypeHeader
          : Array.isArray(contentTypeHeader)
            ? contentTypeHeader.join(';')
            : undefined;
      const statusCode = res.statusCode || 200;
      const { statusCode: resolvedStatus, body } = envelopeJsonResponse(
        statusCode,
        rawBody,
        contentType,
        pathOnly,
      );

      if (body !== rawBody) {
        res.statusCode = resolvedStatus;
        originalWrite(body, 'utf8');
        return originalEnd();
      }

      for (const buf of chunks) {
        originalWrite(buf);
      }
      return originalEnd();
    }) as typeof res.end;

    next();
  };
}
