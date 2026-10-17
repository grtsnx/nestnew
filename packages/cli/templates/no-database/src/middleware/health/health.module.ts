import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { LibModule } from 'src/lib';
import { QueueModule } from '../queue/queue.module';
import {
  QueueHealthIndicator,
  RedisHealthIndicator,
} from './health.indicators';

@Module({
  imports: [TerminusModule.forRoot({ logger: false }), LibModule, QueueModule],
  providers: [RedisHealthIndicator, QueueHealthIndicator],
  exports: [TerminusModule, RedisHealthIndicator, QueueHealthIndicator],
})
export class HealthModule {}
