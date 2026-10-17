import { Global, Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import {
  EMAIL_CLIENT,
  QueueModule,
  createEmailClientFromConfig,
} from 'src/middleware';
import { SendMailsService } from './sendMail.service';

@Global()
@Module({
  imports: [forwardRef(() => QueueModule), ConfigModule],
  providers: [
    {
      provide: EMAIL_CLIENT,
      useFactory: (configService: ConfigService) =>
        createEmailClientFromConfig(configService),
      inject: [ConfigService],
    },
    SendMailsService,
  ],
  exports: [SendMailsService],
})
export class SendMailsModule {}
