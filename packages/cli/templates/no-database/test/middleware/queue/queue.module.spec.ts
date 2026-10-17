import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from 'src/app';
import { EmailProcessor } from 'src/middleware';

const mockWorkerOn = jest.fn();
const mockWorkerClose = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: mockWorkerOn,
    close: mockWorkerClose,
  })),
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
  })),
}));

describe('QueueModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers EmailProcessor on the API process', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module.get(EmailProcessor)).toBeDefined();
    await module.close();
  });

  it('does not start a BullMQ Worker while NODE_ENV=test', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await module.init();

    expect(mockWorkerOn).not.toHaveBeenCalled();
    await module.close();
  });
});
