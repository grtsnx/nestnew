import {
  createAuthEnvelopeMiddleware,
  envelopeJsonResponse,
  isHandleResponseBody,
  rethrowAsHandleResponse,
  toHandleResponseBody,
} from 'src/middleware/common/response-envelope';
import { AUTH_BASE_PATH } from 'src/middleware/config/auth-public-paths';
import { handleResponse } from 'src/middleware';

describe('response-envelope', () => {
  it('detects handleResponse bodies', () => {
    expect(
      isHandleResponseBody({
        statusCode: 200,
        statusType: 'OK',
        message: 'OK',
        data: { id: 1 },
      }),
    ).toBe(true);
    expect(isHandleResponseBody({ token: null, user: {} })).toBe(false);
  });

  it('wraps success payloads in data', () => {
    expect(
      toHandleResponseBody(200, {
        token: null,
        user: { id: 'abc', email: 'jane@mail.test' },
      }),
    ).toEqual({
      statusCode: 200,
      statusType: 'OK',
      message: 'Request succeeded',
      data: {
        token: null,
        user: { id: 'abc', email: 'jane@mail.test' },
      },
    });
  });

  it('maps Better Auth errors to envelope message', () => {
    expect(
      toHandleResponseBody(422, {
        message: 'User already exists. Use another email.',
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
      }),
    ).toEqual({
      statusCode: 422,
      statusType: 'UNPROCESSABLE_ENTITY',
      message: 'Unable to create account',
      data: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
    });
  });

  it('maps compromised password errors to six words or fewer', () => {
    expect(
      toHandleResponseBody(400, {
        message:
          'This password has been found in data breaches. Please choose a different password.',
        code: 'COMPROMISED_PASSWORD',
      }),
    ).toEqual({
      statusCode: 400,
      statusType: 'BAD_REQUEST',
      message: 'Choose different password',
      data: { code: 'COMPROMISED_PASSWORD' },
    });
  });

  it('maps Sentinel account-creation blocks to a complete phrase', () => {
    expect(
      toHandleResponseBody(403, {
        message: 'Account creation is not allowed from this device.',
      }),
    ).toEqual({
      statusCode: 403,
      statusType: 'FORBIDDEN',
      message: 'Too many accounts from this device',
    });
  });

  it('passes through existing envelopes unchanged', () => {
    const envelope = {
      statusCode: 200,
      statusType: 'OK',
      message: 'Login successful',
      data: { ok: true },
    };
    expect(toHandleResponseBody(200, envelope)).toEqual(envelope);
  });

  it('wraps raw Better Auth JSON error bodies for HTTP middleware', () => {
    expect(
      envelopeJsonResponse(
        422,
        JSON.stringify({
          message: 'Unable to create account',
          code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        }),
        'application/json',
      ),
    ).toEqual({
      statusCode: 422,
      body: JSON.stringify({
        statusCode: 422,
        statusType: 'UNPROCESSABLE_ENTITY',
        message: 'Unable to create account',
        data: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
      }),
    });
  });

  it('returns success when sign-in resends verification OTP', () => {
    expect(
      toHandleResponseBody(
        403,
        { message: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' },
        undefined,
        '/v1/auth/signin/email',
      ),
    ).toEqual({
      statusCode: 200,
      statusType: 'OK',
      message: 'Verification OTP sent',
      data: { code: 'EMAIL_NOT_VERIFIED' },
    });

    expect(
      envelopeJsonResponse(
        403,
        JSON.stringify({
          message: 'Email not verified',
          code: 'EMAIL_NOT_VERIFIED',
        }),
        'application/json',
        '/v1/auth/sign-in/email',
      ),
    ).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        statusType: 'OK',
        message: 'Verification OTP sent',
        data: { code: 'EMAIL_NOT_VERIFIED' },
      }),
    });
  });

  it('keeps email-not-verified as forbidden off sign-in routes', () => {
    expect(
      toHandleResponseBody(
        403,
        { message: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' },
        undefined,
        '/v1/auth/signup/email',
      ),
    ).toEqual({
      statusCode: 403,
      statusType: 'FORBIDDEN',
      message: 'Verification OTP sent',
      data: { code: 'EMAIL_NOT_VERIFIED' },
    });
  });

  it('leaves already enveloped JSON unchanged', () => {
    const body = JSON.stringify({
      statusCode: 422,
      statusType: 'UNPROCESSABLE_ENTITY',
      message: 'Unable to create account',
      data: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
    });
    expect(envelopeJsonResponse(422, body, 'application/json')).toEqual({
      statusCode: 422,
      body,
    });
  });

  it('rethrows Better Auth API errors with code in data', () => {
    expect(() =>
      rethrowAsHandleResponse({
        statusCode: 422,
        message: 'Unable to create account',
        body: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
      }),
    ).toThrow(handleResponse);

    try {
      rethrowAsHandleResponse({
        statusCode: 422,
        message: 'Unable to create account',
        body: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
      });
    } catch (error) {
      expect((error as handleResponse).getResponse()).toEqual({
        statusCode: 422,
        statusType: 'UNPROCESSABLE_ENTITY',
        message: 'Unable to create account',
        data: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
      });
    }
  });

  it('skips envelope wrapping for Better Auth Infra routes', () => {
    const middleware = createAuthEnvelopeMiddleware(AUTH_BASE_PATH);
    const infraReq = {
      url: `${AUTH_BASE_PATH}/dash/config`,
    } as import('express').Request;
    const infraRes = {
      write: jest.fn(),
      end: jest.fn(),
      getHeader: jest.fn(),
      statusCode: 200,
    } as unknown as import('express').Response;
    const infraNext = jest.fn();
    const originalWrite = infraRes.write;

    middleware(infraReq, infraRes, infraNext);

    expect(infraNext).toHaveBeenCalledTimes(1);
    expect(infraRes.write).toBe(originalWrite);

    const clientReq = {
      url: `${AUTH_BASE_PATH}/sign-in/email`,
    } as import('express').Request;
    const clientRes = {
      write: jest.fn(),
      end: jest.fn(),
      getHeader: jest.fn(),
      statusCode: 200,
    } as unknown as import('express').Response;
    const clientNext = jest.fn();
    const clientOriginalWrite = clientRes.write;

    middleware(clientReq, clientRes, clientNext);

    expect(clientNext).toHaveBeenCalledTimes(1);
    expect(clientRes.write).not.toBe(clientOriginalWrite);
  });
});
