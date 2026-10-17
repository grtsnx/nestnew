import { ConfigService } from '@nestjs/config';

import { getRequestOrGlobalLogger } from './evlog.factory';

export const FILES_CLIENT = Symbol('FILES_CLIENT');

export type FilesProvider = 'fs' | 's3' | 'r2';

export interface FilesClient {
  upload(...args: unknown[]): Promise<unknown>;
  download(...args: unknown[]): Promise<unknown>;
  head(...args: unknown[]): Promise<unknown>;
  exists(...args: unknown[]): Promise<unknown>;
  list(...args: unknown[]): Promise<unknown>;
  delete(...args: unknown[]): Promise<unknown>;
  url(...args: unknown[]): Promise<unknown>;
}

const AWS_PEER_HINT =
  'Install @aws-sdk/client-s3 @aws-sdk/s3-presigned-post @aws-sdk/s3-request-presigner';

function filesErrorHooks() {
  return {
    onError(event: { error: unknown }) {
      const logger = getRequestOrGlobalLogger();
      logger.error(
        event.error instanceof Error
          ? event.error
          : new Error(String(event.error)),
      );
    },
  };
}

function isMissingModuleError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { code?: string; message?: string };
  return (
    err.code === 'ERR_MODULE_NOT_FOUND' ||
    (typeof err.message === 'string' &&
      (err.message.includes('Cannot find module') ||
        err.message.includes('ERR_MODULE_NOT_FOUND')))
  );
}

function wrapAwsImportError(adapter: 's3' | 'r2', error: unknown): never {
  if (isMissingModuleError(error)) {
    throw new Error(`Failed to load files-sdk/${adapter}. ${AWS_PEER_HINT}`, {
      cause: error,
    });
  }

  throw error instanceof Error ? error : new Error(String(error));
}

export function getFilesProvider(configService: ConfigService): FilesProvider {
  const provider = configService.get<string>('FILES_PROVIDER') ?? 'fs';
  if (provider === 'fs' || provider === 's3' || provider === 'r2') {
    return provider;
  }

  throw new Error(
    `FILES_PROVIDER must be one of: fs, s3, r2 (received "${provider}")`,
  );
}

export async function createFilesClientFromConfig(
  configService: ConfigService,
): Promise<FilesClient> {
  const provider = getFilesProvider(configService);
  const { Files } = await import('files-sdk');
  const hooks = filesErrorHooks();

  if (provider === 'fs') {
    const { fs } = await import('files-sdk/fs');
    return new Files({
      adapter: fs({
        root: configService.get<string>('FILES_FS_ROOT') ?? '.uploads',
      }),
      hooks,
    });
  }

  if (provider === 's3') {
    try {
      const { s3 } = await import('files-sdk/s3');
      const endpoint = configService.get<string>('FILES_S3_ENDPOINT')?.trim();
      return new Files({
        adapter: s3({
          bucket: configService.get<string>('FILES_S3_BUCKET') ?? '',
          region: configService.get<string>('FILES_S3_REGION') ?? '',
          credentials: {
            accessKeyId:
              configService.get<string>('FILES_S3_ACCESS_KEY_ID') ?? '',
            secretAccessKey:
              configService.get<string>('FILES_S3_SECRET_ACCESS_KEY') ?? '',
          },
          ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
        }),
        hooks,
      });
    } catch (error) {
      wrapAwsImportError('s3', error);
    }
  }

  try {
    const { r2 } = await import('files-sdk/r2');
    return new Files({
      adapter: r2({
        accountId: configService.get<string>('FILES_R2_ACCOUNT_ID') ?? '',
        bucket: configService.get<string>('FILES_R2_BUCKET') ?? '',
        accessKeyId: configService.get<string>('FILES_R2_ACCESS_KEY_ID') ?? '',
        secretAccessKey:
          configService.get<string>('FILES_R2_SECRET_ACCESS_KEY') ?? '',
        client: 'fetch',
      }),
      hooks,
    });
  } catch (error) {
    wrapAwsImportError('r2', error);
  }
}
