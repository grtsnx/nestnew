import { Module } from '@nestjs/common';

import { AdminModule } from './admin';
import { AuthModule } from './auth';
import { BillingModule } from './billing';
import { MemberModule } from './member';
import { OrganisationModule } from './organisation';
import { TeamModule } from './team';
import { UserModule } from './user';

@Module({
  imports: [
    AuthModule,
    UserModule,
    OrganisationModule,
    MemberModule,
    TeamModule,
    AdminModule,
    BillingModule,
  ],
})
export class ModModule {}
