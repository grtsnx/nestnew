import {
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  FILES_CLIENT,
  getRequestOrGlobalLogger,
  type FilesClient,
} from 'src/middleware';

type FilesErrorLike = {
  code: 'NotFound' | 'Unauthorized' | 'Conflict' | 'ReadOnly' | 'Provider';
  timedOut?: boolean;
};

function isFilesErrorLike(error: unknown): error is FilesErrorLike {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return (
    code === 'NotFound' ||
    code === 'Unauthorized' ||
    code === 'Conflict' ||
    code === 'ReadOnly' ||
    code === 'Provider'
  );
}

function toHttpException(
  operation: string,
  error: unknown,
):
  | NotFoundException
  | UnauthorizedException
  | ForbiddenException
  | ConflictException
  | GatewayTimeoutException
  | InternalServerErrorException {
  if (isFilesErrorLike(error)) {
    if (error.timedOut) {
      return new GatewayTimeoutException(
        `Timed out while attempting to ${operation} file.`,
      );
    }

    switch (error.code) {
      case 'NotFound':
        return new NotFoundException(`File not found.`);
      case 'Unauthorized':
        return new UnauthorizedException(
          `Not authorized to ${operation} file.`,
        );
      case 'Conflict':
        return new ConflictException(`File conflict during ${operation}.`);
      case 'ReadOnly':
        return new ForbiddenException(`File storage is read-only.`);
      case 'Provider':
        return new InternalServerErrorException(
          `Failed to ${operation} file.`,
        );
      default:
        return new InternalServerErrorException(
          `Failed to ${operation} file.`,
        );
    }
  }

  return new InternalServerErrorException(`Failed to ${operation} file.`);
}

@Injectable()
export class FilesService {
  constructor(
    @Inject(FILES_CLIENT) private readonly files: FilesClient,
    private readonly configService: ConfigService,
  ) {}

  upload(key: string, body: unknown, options?: unknown): Promise<unknown> {
    return this.run('upload', 1, () => this.files.upload(key, body, options));
  }

  download(key: string, options?: unknown): Promise<unknown> {
    return this.run('download', 1, () => this.files.download(key, options));
  }

  head(key: string, options?: unknown): Promise<unknown> {
    return this.run('head', 1, () => this.files.head(key, options));
  }

  exists(key: string, options?: unknown): Promise<unknown> {
    return this.run('exists', 1, () => this.files.exists(key, options));
  }

  list(options?: unknown): Promise<unknown> {
    return this.run('list', 0, () => this.files.list(options));
  }

  delete(key: string, options?: unknown): Promise<unknown> {
    return this.run('delete', 1, () => this.files.delete(key, options));
  }

  url(key: string, options?: unknown): Promise<unknown> {
    return this.run('url', 1, () => this.files.url(key, options));
  }

  private async run<T>(
    operation: string,
    keyCount: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const logger = getRequestOrGlobalLogger();
    logger.set({
      files: {
        provider: this.configService.get<string>('FILES_PROVIDER') ?? 'fs',
        operation,
        keyCount,
      },
    });

    try {
      return await fn();
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)));
      throw toHttpException(operation, error);
    }
  }
}
