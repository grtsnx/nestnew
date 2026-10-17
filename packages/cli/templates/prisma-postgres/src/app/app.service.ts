import { HttpException, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthCheckService } from '@nestjs/terminus';

import {
  emitServerFault,
  handleResponse,
  QueueHealthIndicator,
  RedisHealthIndicator,
  toReadinessChecks,
  toReadinessMessage,
} from 'src/middleware';

@Injectable()
export class AppService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly queueHealth: QueueHealthIndicator,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): never {
    throw new handleResponse(200, 'Server is up', { status: 'up' });
  }

  async getReadiness(): Promise<never> {
    try {
      const result = await this.health.check([
        () => this.redisHealth.isHealthy('redis'),
        () => Promise.resolve(this.queueHealth.isHealthy('queue')),
      ]);
      throw new handleResponse(200, 'Services ready', toReadinessChecks(result));
    } catch (error) {
      if (error instanceof handleResponse) {
        throw error;
      }

      const payload = readinessFailurePayload(error);
      if (payload !== undefined) {
        const checks = toReadinessChecks(payload);
        const message = toReadinessMessage(checks);
        emitServerFault(message, {
          health: { check: 'readiness', checks },
        });
        throw new handleResponse(503, message, checks);
      }

      throw error;
    }
  }
}

function readinessFailurePayload(error: unknown): unknown {
  if (error instanceof HealthCheckError) {
    return error.causes;
  }
  if (error instanceof HttpException && error.getStatus() === 503) {
    return error.getResponse();
  }
  return undefined;
}
