import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { AppService } from './app.service';
import { handleResponse } from 'src/middleware';

@ApiTags('Server')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Root endpoint' })
  getHello(): never {
    throw new handleResponse(200, 'OK', {
      message: this.appService.getHello(),
    });
  }

  @SkipThrottle()
  @Get('health')
  @ApiOperation({ summary: 'Liveness check' })
  getHealth(): never {
    return this.appService.getHealth();
  }

  @SkipThrottle()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness check (Redis + queue)' })
  async getReadiness(): Promise<never> {
    return this.appService.getReadiness();
  }
}
