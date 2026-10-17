import { HttpException, HttpStatus } from '@nestjs/common';

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

export class handleResponse extends HttpException {
  constructor(
    public statusCode: number,
    public message: string,
    public data?: unknown,
  ) {
    const response: Record<string, unknown> = {
      statusCode,
      statusType: getStatusType(statusCode),
      message,
    };

    if (data !== undefined) {
      response.data = data;
    }

    super(response, statusCode);
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
