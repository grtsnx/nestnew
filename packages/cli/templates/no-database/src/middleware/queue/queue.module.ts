import { forwardRef, Module } from '@nestjs/common';

import { SendMailsModule } from 'src/lib';
import { EmailProcessor } from './email.processor';
import { QueueService } from './queue.service';

@Module({
  imports: [forwardRef(() => SendMailsModule)],
  providers: [QueueService, EmailProcessor],
  exports: [QueueService, EmailProcessor],
})
export class QueueModule {}
