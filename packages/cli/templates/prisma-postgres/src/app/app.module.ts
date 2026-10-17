import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EvlogModule } from 'evlog/nestjs';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LibModule } from 'src/lib';
import { ModModule } from 'src/modules';
import {
  createEvlogDrain,
  createEvlogHttpOptions,
  EvlogShutdownHost,
  evlogInputFromConfig,
  GlobalExceptionFilter,
  HealthModule,
  QueueModule,
  validateEnv,
} from 'src/middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    EvlogModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createEvlogHttpOptions(evlogInputFromConfig(config)),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('RATE_LIMIT_TTL') ?? 60000,
            limit: config.get<number>('RATE_LIMIT_MAX') ?? 30,
          },
        ],
      }),
    }),
    HealthModule,
    QueueModule,
    LibModule,
    ModModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: EvlogShutdownHost,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new EvlogShutdownHost(createEvlogDrain(evlogInputFromConfig(config))),
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useFactory: (configService: ConfigService) =>
        new GlobalExceptionFilter(
          configService.get<string>('NODE_ENV') === 'production',
        ),
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
