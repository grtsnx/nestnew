import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';

import { AppController } from 'src/app';
import { AppService } from 'src/app/app.service';
import {
  handleResponse,
  QueueHealthIndicator,
  RedisHealthIndicator,
} from 'src/middleware';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: RedisHealthIndicator, useValue: { isHealthy: jest.fn() } },
        { provide: QueueHealthIndicator, useValue: { isHealthy: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should throw handleResponse with Hello World data', () => {
      expect(() => appController.getHello()).toThrow(handleResponse);

      try {
        appController.getHello();
      } catch (error) {
        expect(error).toBeInstanceOf(handleResponse);
        expect((error as handleResponse).getResponse()).toEqual({
          statusCode: 200,
          statusType: 'OK',
          message: 'OK',
          data: { message: 'Hello World!' },
        });
      }
    });
  });

  describe('getHealth', () => {
    it('should delegate to AppService.getHealth', () => {
      expect(() => appController.getHealth()).toThrow(handleResponse);
    });
  });

  describe('getReadiness', () => {
    it('should delegate to AppService.getReadiness', async () => {
      const spy = jest
        .spyOn(appService, 'getReadiness')
        .mockRejectedValue(new handleResponse(503, 'Service Unavailable', {}));

      await expect(appController.getReadiness()).rejects.toBeInstanceOf(
        handleResponse,
      );
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
