import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { log } from 'evlog';

import type { SendEmailJobPayload } from 'src/lib';
import {
  attachRedisErrorListener,
  getRedisConnectionOptions,
  toBullmqConnection,
} from '../common/redis-connection';

export const EMAIL_QUEUE_NAME = 'email';
export const EMAIL_JOB_SEND = 'email.send';

export const EMAIL_JOB_DEFAULTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const connection = getRedisConnectionOptions(this.configService);
    if (!connection) {
      log.debug({ queue: { enabled: false } });
      return;
    }

    this.queue = new Queue(EMAIL_QUEUE_NAME, {
      connection: toBullmqConnection(connection),
    });
    attachRedisErrorListener(this.queue, 'queue');
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  isEnabled(): boolean {
    return this.queue !== null;
  }

  async enqueue(
    jobName: string,
    payload: SendEmailJobPayload,
  ): Promise<boolean> {
    if (!this.queue) {
      log.warn({ queue: { enabled: false, jobName } });
      return false;
    }

    await this.queue.add(jobName, payload, EMAIL_JOB_DEFAULTS);
    return true;
  }

  async enqueueEmailSend(payload: SendEmailJobPayload): Promise<boolean> {
    return this.enqueue(EMAIL_JOB_SEND, payload);
  }
}
