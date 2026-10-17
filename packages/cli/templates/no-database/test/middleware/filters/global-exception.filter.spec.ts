import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { useLogger } from 'evlog/nestjs';

import { GlobalExceptionFilter, handleResponse } from 'src/middleware';

const mockError = jest.fn();

jest.mock('evlog/nestjs', () => ({
  useLogger: jest.fn(() => ({ error: mockError })),
}));

describe('GlobalExceptionFilter', () => {
  const createHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
      }),
    } as unknown as ArgumentsHost;

    return { host, status, json };
  };

  beforeEach(() => {
    mockError.mockClear();
  });

  it('passes through handleResponse unchanged', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host, status, json } = createHost();
    const error = new handleResponse(200, 'OK', { status: 'up' });

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(error.getResponse());
  });

  it('does not log handleResponse control flow as errors', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host } = createHost();
    filter.catch(new handleResponse(200, 'OK'), host);
    expect(mockError).not.toHaveBeenCalled();
  });

  it('maps validation errors from HttpException objects', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host, status, json } = createHost();

    filter.catch(
      new HttpException(
        {
          message: ['email must be valid', 'name is required'],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      statusType: 'BAD_REQUEST',
      message: 'Validation failed',
      data: { errors: ['email must be valid', 'name is required'] },
    });
  });

  it('maps HttpException to handleResponse shape', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host, status, json } = createHost();

    filter.catch(
      new HttpException('Bad request', HttpStatus.BAD_REQUEST),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      statusType: 'BAD_REQUEST',
      message: 'Bad request',
    });
  });

  it('does not log 4xx HttpException as unexpected errors', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host } = createHost();
    filter.catch(
      new HttpException('Cannot GET /json/version', HttpStatus.NOT_FOUND),
      host,
    );
    expect(mockError).not.toHaveBeenCalled();
  });

  it('logs 5xx HttpException failures', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host } = createHost();
    const error = new HttpException(
      'upstream failed',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    filter.catch(error, host);
    expect(mockError).toHaveBeenCalledWith(error);
  });

  it('hides stack traces in production for unknown errors', () => {
    const filter = new GlobalExceptionFilter(true);
    const { host, json } = createHost();

    filter.catch(new Error('Database exploded'), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      statusType: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  });

  it('maps HttpException object messages that are strings', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host, json } = createHost();

    filter.catch(
      new HttpException(
        { message: 'Not found', error: 'Not Found' },
        HttpStatus.NOT_FOUND,
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      statusType: 'NOT_FOUND',
      message: 'Not found',
    });
  });

  it('falls back when HttpException response is neither string nor object', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host, json } = createHost();
    const error = new HttpException('ignored', HttpStatus.BAD_REQUEST);
    jest.spyOn(error, 'getResponse').mockReturnValue(404 as never);

    filter.catch(error, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      statusType: 'BAD_REQUEST',
      message: 'ignored',
    });
  });

  it('wraps non-Error throws before logging', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host } = createHost();
    filter.catch('boom', host);
    expect(mockError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('continues when the request logger is unavailable', () => {
    (useLogger as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no scope');
    });

    const filter = new GlobalExceptionFilter(false);
    const { host, json } = createHost();
    filter.catch(new Error('still handled'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'still handled',
      }),
    );
  });

  it('includes stack traces in development for unknown errors', () => {
    const filter = new GlobalExceptionFilter(false);
    const { host, json } = createHost();
    const error = new Error('Database exploded');

    filter.catch(error, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Database exploded',
        data: { stack: error.stack },
      }),
    );
  });
});
