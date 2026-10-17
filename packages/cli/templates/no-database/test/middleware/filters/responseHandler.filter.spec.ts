import { handleResponse } from 'src/middleware';

describe('handleResponse', () => {
  it('builds a success response with data', () => {
    const response = new handleResponse(200, 'OK', { id: 1 });

    expect(response.getStatus()).toBe(200);
    expect(response.getResponse()).toEqual({
      statusCode: 200,
      statusType: 'OK',
      message: 'OK',
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
});
