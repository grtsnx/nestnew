import { handleResponse, toClientMessage } from 'src/middleware';

describe('handleResponse', () => {
  it('builds a success response with data', () => {
    const response = new handleResponse(200, 'Request succeeded', { id: 1 });

    expect(response.getStatus()).toBe(200);
    expect(response.getResponse()).toEqual({
      statusCode: 200,
      statusType: 'OK',
      message: 'Request succeeded',
      data: { id: 1 },
    });
  });

  it('omits data when not provided', () => {
    const response = new handleResponse(404, 'Not found');

    expect(response.getResponse()).toEqual({
      statusCode: 404,
      statusType: 'NOT_FOUND',
      message: 'Not found',
    });
  });

  it('uses UNKNOWN statusType for non-standard codes', () => {
    const response = new handleResponse(499, 'Custom error');

    expect(response.getResponse().statusType).toBe('UNKNOWN');
  });

  it('maps compromised-password plugin errors to six words or fewer', () => {
    const response = new handleResponse(
      400,
      'This password has been found in data breaches. Please choose a different password.',
      { code: 'COMPROMISED_PASSWORD' },
    );

    expect(response.getResponse()).toEqual({
      statusCode: 400,
      statusType: 'BAD_REQUEST',
      message: 'Choose different password',
      data: { code: 'COMPROMISED_PASSWORD' },
    });
  });
});

describe('toClientMessage', () => {
  it('pads a one-word error and maps long Better Auth copy', () => {
    expect(toClientMessage('ignored', undefined, 400)).toBe('ignored failed');
    expect(
      toClientMessage(
        'User already exists. Use another email.',
        undefined,
        422,
      ),
    ).toBe('Unable to create account');
  });

  it('maps Better Auth error codes before truncating', () => {
    expect(
      toClientMessage(
        'User already exists. Use another email.',
        { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
        422,
      ),
    ).toBe('Unable to create account');
    expect(
      toClientMessage('Invalid email', { code: 'INVALID_EMAIL' }, 400),
    ).toBe('Invalid login details');
    expect(
      toClientMessage('User not found', { code: 'USER_NOT_FOUND' }, 401),
    ).toBe('Invalid login details');
    expect(toClientMessage('OK', undefined, 200)).toBe('Request succeeded');
    expect(
      toClientMessage('Email not verified', { code: 'EMAIL_NOT_VERIFIED' }, 403),
    ).toBe('Verification OTP sent');
    expect(
      toClientMessage(
        'Email already verified',
        { code: 'EMAIL_ALREADY_VERIFIED' },
        400,
      ),
    ).toBe('Email already verified');
  });

  it('maps Sentinel signup blocks to complete phrases', () => {
    expect(
      toClientMessage(
        'Account creation is not allowed without device identification.',
        undefined,
        403,
      ),
    ).toBe('Device identification required');
    expect(
      toClientMessage(
        'Account creation is not allowed from this device.',
        undefined,
        403,
      ),
    ).toBe('Too many accounts from this device');
  });

  it('uses a status fallback instead of slicing unknown long copy', () => {
    expect(
      toClientMessage(
        'Something completely unknown happened during processing today',
        undefined,
        403,
      ),
    ).toBe('Access denied');
  });
});
