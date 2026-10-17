import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';

import { RedisService } from 'src/lib';
import { EmailProcessor } from '../queue/email.processor';
import { QueueService } from '../queue/queue.service';

export type ReadinessCheck = {
  status: 'up' | 'down';
  reason?: string;
};

export type ReadinessChecks = {
  redis?: ReadinessCheck;
  queue?: ReadinessCheck;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return true;
}

function asCheck(value: unknown): ReadinessCheck {
  if (!isRecord(value)) {
    return { status: 'down' };
  }
  if (value.status === 'up') {
    return { status: 'up' };
  }
  const reason = typeof value.message === 'string' ? value.message : undefined;
  return reason ? { status: 'down', reason } : { status: 'down' };
}

function indicatorMap(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return {};
  }
  if (isRecord(payload.details)) {
    return payload.details;
  }
  if (isRecord(payload.info) || isRecord(payload.error)) {
    return {
      ...(isRecord(payload.info) ? payload.info : {}),
      ...(isRecord(payload.error) ? payload.error : {}),
    };
  }
  return payload;
}

export function toReadinessChecks(payload: unknown): ReadinessChecks {
  const indicators = indicatorMap(payload);
  const checks: ReadinessChecks = {};
  if (indicators.redis !== undefined) {
    checks.redis = asCheck(indicators.redis);
  }
  if (indicators.queue !== undefined) {
    checks.queue = asCheck(indicators.queue);
  }
  return checks;
}

export function toReadinessMessage(checks: ReadinessChecks): string {
  const down = (['redis', 'queue'] as const).flatMap((key) => {
    const check = checks[key];
    return check?.status === 'down' ? [key] : [];
  });
  if (down.length === 0) {
    return 'OK';
  }
  const reasons = [
    ...new Set(
      down.flatMap((key) => {
        const reason = checks[key]?.reason;
        return reason ? [reason] : [];
      }),
    ),
  ];
  const names = down.join(' and ');
  if (reasons.length === 1) {
    return `${names} unavailable: ${reasons[0]}`;
  }
  return `${names} unavailable`;
}

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.redisService.isEnabled()) {
      throw new HealthCheckError(
        'Redis is not configured',
        this.getStatus(key, false, { message: 'REDIS_URL is unset' }),
      );
    }

    const isAlive = await this.redisService.ping();
    if (!isAlive) {
      throw new HealthCheckError(
        'Redis ping failed',
        this.getStatus(key, false, { message: 'PING failed' }),
      );
    }

    return this.getStatus(key, true);
  }
}

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(
    private readonly queueService: QueueService,
    private readonly emailProcessor: EmailProcessor,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  isHealthy(key: string): HealthIndicatorResult {
    if (!this.queueService.isEnabled()) {
      throw new HealthCheckError(
        'Queue is not configured',
        this.getStatus(key, false, { message: 'REDIS_URL is unset' }),
      );
    }

    const role = this.configService.get<string>('PROCESS_ROLE') ?? 'all';
    if (role !== 'api' && !this.emailProcessor.isRunning()) {
      throw new HealthCheckError(
        'Email worker is not running',
        this.getStatus(key, false, { message: 'email worker is not running' }),
      );
    }

    return this.getStatus(key, true);
  }
}
