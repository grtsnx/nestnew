import { ConfigService } from '@nestjs/config';
import { useLogger } from 'evlog/nestjs';

import { filesClientConfigFixtures } from '../../fixtures';
import { mockFiles, resetFilesMock } from '../../mocks/files-sdk';
import { mockFs, resetFsMock } from '../../mocks/files-sdk-fs';
import { mockR2, resetR2Mock } from '../../mocks/files-sdk-r2';
import { mockS3, resetS3Mock } from '../../mocks/files-sdk-s3';
import { createFilesClientFromConfig, getFilesProvider } from 'src/middleware';

jest.mock('evlog/nestjs', () => ({
  useLogger: jest.fn(() => ({
    set: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  })),
}));

function createConfigService(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('files-client.factory', () => {
  beforeEach(() => {
    (useLogger as jest.Mock).mockReturnValue({
      set: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    });
    resetFilesMock();
    resetFsMock();
    resetS3Mock();
    resetR2Mock();
  });

  it('resolves supported providers', () => {
    expect(
      getFilesProvider(createConfigService(filesClientConfigFixtures.fs)),
    ).toBe('fs');
    expect(
      getFilesProvider(createConfigService(filesClientConfigFixtures.s3)),
    ).toBe('s3');
    expect(
      getFilesProvider(createConfigService(filesClientConfigFixtures.r2)),
    ).toBe('r2');
  });

  it('throws for invalid files provider', () => {
    expect(() =>
      getFilesProvider(
        createConfigService(filesClientConfigFixtures.invalidProvider),
      ),
    ).toThrow('FILES_PROVIDER must be one of');
  });

  it('constructs an fs adapter with FILES_FS_ROOT', async () => {
    await createFilesClientFromConfig(
      createConfigService(filesClientConfigFixtures.fs),
    );

    expect(mockFs).toHaveBeenCalledWith({ root: '.uploads' });
    expect(mockFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: { name: 'fs', opts: { root: '.uploads' } },
      }),
    );

    const constructorCalls = mockFiles.mock.calls as unknown as Array<
      [{ hooks: { onError: (event: { error: unknown }) => void } }]
    >;
    const constructed = constructorCalls[0]?.[0];
    if (!constructed) {
      throw new Error('expected Files constructor to be called');
    }
    constructed.hooks.onError({ error: new Error('adapter failed') });
    constructed.hooks.onError({ error: 'adapter failed' });
  });

  it('constructs an s3 adapter with bucket, region, and credentials', async () => {
    await createFilesClientFromConfig(
      createConfigService(filesClientConfigFixtures.s3),
    );

    expect(mockS3).toHaveBeenCalledWith({
      bucket: 'uploads',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      },
    });
  });

  it('passes S3 endpoint and path-style when FILES_S3_ENDPOINT is set', async () => {
    await createFilesClientFromConfig(
      createConfigService(filesClientConfigFixtures.s3WithEndpoint),
    );

    expect(mockS3).toHaveBeenCalledWith({
      bucket: 'uploads',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      },
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
    });
  });

  it('constructs an r2 adapter with account, bucket, and fetch client', async () => {
    await createFilesClientFromConfig(
      createConfigService(filesClientConfigFixtures.r2),
    );

    expect(mockR2).toHaveBeenCalledWith({
      accountId: 'acct',
      bucket: 'uploads',
      accessKeyId: 'r2-key',
      secretAccessKey: 'r2-secret',
      client: 'fetch',
    });
  });

  it('surfaces a clear error when the S3 adapter cannot load AWS peers', async () => {
    mockFiles.mockImplementationOnce(() => {
      throw Object.assign(
        new Error("Cannot find module '@aws-sdk/client-s3'"),
        {
          code: 'ERR_MODULE_NOT_FOUND',
        },
      );
    });

    await expect(
      createFilesClientFromConfig(
        createConfigService(filesClientConfigFixtures.s3),
      ),
    ).rejects.toThrow('Failed to load files-sdk/s3');
  });

  it('rethrows non-module errors from the S3 adapter', async () => {
    mockFiles.mockImplementationOnce(() => {
      throw new Error('invalid bucket');
    });

    await expect(
      createFilesClientFromConfig(
        createConfigService(filesClientConfigFixtures.s3),
      ),
    ).rejects.toThrow('invalid bucket');
  });

  it('wraps non-Error throws from the R2 adapter', async () => {
    mockFiles.mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- cover non-Error adapter failures
      throw 'r2 exploded';
    });

    await expect(
      createFilesClientFromConfig(
        createConfigService(filesClientConfigFixtures.r2),
      ),
    ).rejects.toThrow('r2 exploded');
  });

  it('treats missing-module messages without an ERR code as adapter load failures', async () => {
    mockFiles.mockImplementationOnce(() => {
      throw new Error("Cannot find module '@aws-sdk/client-s3'");
    });

    await expect(
      createFilesClientFromConfig(
        createConfigService(filesClientConfigFixtures.s3),
      ),
    ).rejects.toThrow('Failed to load files-sdk/s3');
  });
});
