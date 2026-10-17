import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SkipThrottle } from '@nestjs/throttler';

import { AppService } from './app.service';
import { handleResponse } from 'src/middleware';

@ApiTags('Server')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @AllowAnonymous()
  @Get()
  @ApiOperation({ summary: 'Say hello' })
  getHello(): never {
    throw new handleResponse(200, 'Hello World', {
      message: this.appService.getHello(),
    });
  }

  @AllowAnonymous()
  @SkipThrottle()
  @Get('health')
  @ApiOperation({ summary: 'Confirm the server is up' })
  getHealth(): never {
    return this.appService.getHealth();
  }

  @AllowAnonymous()
  @SkipThrottle()
  @Get('health/ready')
  @ApiOperation({ summary: 'Check Redis and queue' })
  async getReadiness(): Promise<never> {
    return this.appService.getReadiness();
  }
}
