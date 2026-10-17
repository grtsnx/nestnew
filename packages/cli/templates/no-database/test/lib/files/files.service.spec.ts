import {
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { useLogger } from 'evlog/nestjs';
import { FilesError } from 'files-sdk';

import { FilesService } from 'src/lib';
import { FILES_CLIENT } from 'src/middleware';

jest.mock('evlog/nestjs', () => ({
  useLogger: jest.fn(() => ({
    set: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  })),
}));

describe('FilesService', () => {
  let service: FilesService;
  let filesClient: {
    upload: jest.Mock;
    download: jest.Mock;
    head: jest.Mock;
    exists: jest.Mock;
    list: jest.Mock;
    delete: jest.Mock;
    url: jest.Mock;
  };
  let logger: { set: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    logger = { set: jest.fn(), error: jest.fn() };
    (useLogger as jest.Mock).mockReturnValue(logger);

    filesClient = {
      upload: jest.fn().mockResolvedValue({ key: 'a.txt' }),
      download: jest.fn().mockResolvedValue({ key: 'a.txt' }),
      head: jest.fn().mockResolvedValue({ key: 'a.txt' }),
      exists: jest.fn().mockResolvedValue(true),
      list: jest.fn().mockResolvedValue({ items: [], cursor: undefined }),
      delete: jest.fn().mockResolvedValue(undefined),
      url: jest.fn().mockResolvedValue('https://cdn.example.com/a.txt'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: FILES_CLIENT,
          useValue: filesClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'FILES_PROVIDER' ? 'fs' : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get(FilesService);
  });

  it('forwards upload and logs provider, operation, and keyCount', async () => {
    await expect(service.upload('a.txt', 'hello')).resolves.toEqual({
      key: 'a.txt',
    });

    expect(filesClient.upload).toHaveBeenCalledWith(
      'a.txt',
      'hello',
      undefined,
    );
    expect(logger.set).toHaveBeenCalledWith({
      files: { provider: 'fs', operation: 'upload', keyCount: 1 },
    });
  });

  it('forwards download, head, exists, list, delete, and url', async () => {
    await service.download('a.txt');
    await service.head('a.txt');
    await service.exists('a.txt');
    await service.list({ prefix: 'a/' });
    await service.delete('a.txt');
    await service.url('a.txt', { expiresIn: 60 });

    expect(filesClient.download).toHaveBeenCalledWith('a.txt', undefined);
    expect(filesClient.head).toHaveBeenCalledWith('a.txt', undefined);
    expect(filesClient.exists).toHaveBeenCalledWith('a.txt', undefined);
    expect(filesClient.list).toHaveBeenCalledWith({ prefix: 'a/' });
    expect(filesClient.delete).toHaveBeenCalledWith('a.txt', undefined);
    expect(filesClient.url).toHaveBeenCalledWith('a.txt', { expiresIn: 60 });
  });

  it('maps FilesError NotFound to 404', async () => {
    filesClient.download.mockRejectedValue(
      new FilesError('NotFound', 'missing'),
    );

    await expect(service.download('missing.txt')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps FilesError Unauthorized to 401', async () => {
    filesClient.upload.mockRejectedValue(
      new FilesError('Unauthorized', 'denied'),
    );

    await expect(service.upload('a.txt', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('maps FilesError Conflict to 409', async () => {
    filesClient.upload.mockRejectedValue(new FilesError('Conflict', 'exists'));

    await expect(service.upload('a.txt', 'x')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps FilesError ReadOnly to 403', async () => {
    filesClient.delete.mockRejectedValue(new FilesError('ReadOnly', 'ro'));

    await expect(service.delete('a.txt')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('maps timed-out FilesError to 504', async () => {
    filesClient.head.mockRejectedValue(
      new FilesError('Provider', 'slow', undefined, { timedOut: true }),
    );

    await expect(service.head('a.txt')).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });

  it('wraps unknown client failures as 500 without leaking details', async () => {
    filesClient.upload.mockRejectedValue(new Error('secret bucket denied'));

    await expect(service.upload('a.txt', 'hello')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    await expect(service.upload('a.txt', 'hello')).rejects.toThrow(
      'Failed to upload file.',
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('wraps non-Error client failures', async () => {
    filesClient.upload.mockRejectedValue('nope');

    await expect(service.upload('a.txt', 'hello')).rejects.toThrow(
      'Failed to upload file.',
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
