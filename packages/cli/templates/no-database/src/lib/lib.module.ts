import { Module } from '@nestjs/common';

import { SendMailsModule } from './email/sendMail.module';
import { GravatarModule } from './gravatar/gravatar.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [RedisModule, SendMailsModule, GravatarModule],
  exports: [RedisModule, SendMailsModule, GravatarModule],
})
export class LibModule {}
