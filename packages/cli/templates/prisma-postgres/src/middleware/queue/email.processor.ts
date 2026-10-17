import {
  forwardRef,
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { createRequestLogger } from 'evlog';

import { SendMailsService, type SendEmailJobPayload } from 'src/lib';
import {
  attachRedisErrorListener,
  getRedisConnectionOptions,
  toBullmqConnection,
} from '../common/redis-connection';
import {
  applyFlatStructuredError,
  emitServerFault,
  logStartup,
} from '../config/evlog.factory';
import { EMAIL_JOB_SEND, EMAIL_QUEUE_NAME } from './queue.service';

/** True when this process should consume BullMQ email jobs. */
export function shouldStartEmailWorker(configService: ConfigService): boolean {
  const connection = getRedisConnectionOptions(configService);
  if (!connection) {
    return false;
  }

  if (configService.get<string>('NODE_ENV') === 'test') {
    return false;
  }

  const role = configService.get<string>('PROCESS_ROLE') ?? 'all';
  return role !== 'api';
}

@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SendMailsService))
    private readonly sendMailsService: SendMailsService,
  ) {}

  onModuleInit(): void {
    if (!shouldStartEmailWorker(this.configService)) {
      return;
    }

    const connection = getRedisConnectionOptions(this.configService);
    if (!connection) {
      return;
    }

    this.worker = new Worker(
      EMAIL_QUEUE_NAME,
      async (job) => {
        const jobLog = createRequestLogger({
          requestId: String(job.id ?? 'unknown'),
        });
        try {
          if (job.name !== EMAIL_JOB_SEND) {
            jobLog.set({ queue: { ignored: true, jobName: job.name } });
            return;
          }

          const payload = job.data as SendEmailJobPayload;
          const toCount = Array.isArray(payload.to) ? payload.to.length : 1;
          jobLog.set({
            queue: { name: EMAIL_QUEUE_NAME },
            job: { id: String(job.id ?? ''), name: job.name },
            email: { template: payload.template, toCount },
          });

          await this.sendMailsService.sendEmail(
            payload.to,
            payload.subject,
            payload.template,
            payload.context,
          );
        } catch (error) {
          applyFlatStructuredError(
            jobLog,
            error instanceof Error ? error : new Error(String(error)),
            'process',
          );
          jobLog.set({ status: 500 });
          throw error;
        } finally {
          jobLog.emit();
        }
      },
      {
        connection: toBullmqConnection(connection),
      },
    );

    attachRedisErrorListener(this.worker, 'worker');
    this.worker.on('failed', (_job, error) => {
      emitServerFault(error, {
        queue: { name: EMAIL_QUEUE_NAME, event: 'failed' },
      });
    });

    logStartup('queue', 'Email worker listening');
  }

  isRunning(): boolean {
    return this.worker !== null;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.worker) {
      return;
    }
    await this.worker.close();
    this.worker = null;
  }
}
