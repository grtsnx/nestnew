import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/lib/prisma/generated/client';
import { normalizePgConnectionString } from 'src/lib/prisma/pg-connection';
import { logStartup } from 'src/middleware';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient | null;

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('DATABASE_URL')?.trim() ?? '';
    const connectionString = raw ? normalizePgConnectionString(raw) : '';
    const poolMax = this.configService.get<number>('DB_POOL_MAX') ?? 10;
    this.prisma = connectionString
      ? new PrismaClient({
          adapter: new PrismaPg({
            connectionString,
            keepAlive: true,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
            // Bound the pg pool so a single instance can't exhaust Postgres
            // connections under load (and stays predictable if replicated).
            max: poolMax,
          }),
        })
      : null;
  }

  isEnabled(): boolean {
    return this.prisma !== null;
  }

  client(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database is not configured (DATABASE_URL is unset)');
    }
    return this.prisma;
  }

  async ping(): Promise<boolean> {
    if (!this.prisma) {
      return false;
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.prisma) {
      logStartup(
        'database',
        'DATABASE_URL not set; database operations are disabled',
        'warn',
      );
      return;
    }

    await this.prisma.$connect();
    logStartup('database', 'connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }
}
