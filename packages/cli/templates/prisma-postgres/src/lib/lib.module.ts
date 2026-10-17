import { Module } from '@nestjs/common';

import { SendMailsModule } from './email/sendMail.module';
import { GravatarModule } from './gravatar/gravatar.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [RedisModule, SendMailsModule, GravatarModule, PrismaModule],
  exports: [RedisModule, SendMailsModule, GravatarModule, PrismaModule],
})
export class LibModule {}
