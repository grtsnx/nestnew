import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';

import type { Session as AuthSession } from 'src/lib';
import { AttachPlanDto, CheckAccessDto, TrackUsageDto } from 'src/dto';

import { BillingService } from './billing.service';

@ApiTags('Billing')
@ApiBearerAuth('bearer')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('customer')
  @ApiOperation({ summary: 'Sync billing customer' })
  syncCustomer(@Session() session: AuthSession): Promise<never> {
    return this.billingService.syncCustomer(session);
  }

  @Post('check')
  @ApiOperation({ summary: 'Check feature access' })
  check(
    @Session() session: AuthSession,
    @Body() body: CheckAccessDto,
  ): Promise<never> {
    return this.billingService.checkAccess(
      session,
      body.featureId,
      body.requiredBalance,
    );
  }

  @Post('attach')
  @ApiOperation({ summary: 'Attach a plan' })
  attach(
    @Session() session: AuthSession,
    @Body() body: AttachPlanDto,
  ): Promise<never> {
    return this.billingService.attachPlan(session, body.planId);
  }

  @Post('track')
  @ApiOperation({ summary: 'Record feature usage' })
  track(
    @Session() session: AuthSession,
    @Body() body: TrackUsageDto,
  ): Promise<never> {
    return this.billingService.trackUsage(
      session,
      body.featureId,
      body.value ?? 1,
    );
  }

  @Get('balance')
  @ApiOperation({ summary: 'See credit balance' })
  balance(@Session() session: AuthSession): Promise<never> {
    return this.billingService.getBalance(session);
  }
}
