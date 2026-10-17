import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from 'src/app';
import { configureApp } from 'src/middleware';

process.env.PROCESS_ROLE = 'api';

const hasRedis = Boolean(process.env.REDIS_URL?.trim());

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / returns handleResponse envelope', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({
        statusCode: 200,
        statusType: 'OK',
        message: 'Hello World',
        data: { message: 'Hello World!' },
      });
  });

  it('GET /health returns handleResponse envelope with up status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        statusCode: 200,
        statusType: 'OK',
        message: 'Server is up',
        data: { status: 'up' },
      });
  });

  if (hasRedis) {
    it('GET /health/ready returns 200 when Redis is configured (PROCESS_ROLE=api)', () => {
      return request(app.getHttpServer())
        .get('/health/ready')
        .expect(200)
        .expect((res) => {
          const body = res.body as {
            statusCode: number;
            statusType: string;
            message: string;
            data: {
              redis: { status: string };
              queue: { status: string };
            };
          };
          expect(body.statusCode).toBe(200);
          expect(body.statusType).toBe('OK');
          expect(body.message).toBe('Services ready');
          expect(body.data.redis).toEqual({ status: 'up' });
          expect(body.data.queue).toEqual({ status: 'up' });
        });
    });
  } else {
    it('GET /health/ready returns 503 when Redis is not configured', () => {
      return request(app.getHttpServer())
        .get('/health/ready')
        .expect(503)
        .expect((res) => {
          const body = res.body as {
            statusCode: number;
            statusType: string;
            message: string;
            data: unknown;
          };
          expect(body.statusCode).toBe(503);
          expect(body.statusType).toBe('SERVICE_UNAVAILABLE');
          expect(body.message).toBe('Services unavailable');
          expect(body.data).toEqual({
            redis: { status: 'down', reason: 'REDIS_URL is unset' },
            queue: { status: 'down', reason: 'REDIS_URL is unset' },
          });
        });
    });
  }
});
