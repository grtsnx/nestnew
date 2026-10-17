export const mockFiles = jest.fn();

export type FilesErrorCode =
  'NotFound' | 'Unauthorized' | 'Conflict' | 'ReadOnly' | 'Provider';

export class FilesError extends Error {
  readonly code: FilesErrorCode;
  readonly aborted: boolean;
  readonly timedOut: boolean;
  readonly permanent: boolean;
  readonly cause?: unknown;

  constructor(
    code: FilesErrorCode,
    message: string,
    cause?: unknown,
    opts?: { aborted?: boolean; timedOut?: boolean; permanent?: boolean },
  ) {
    super(message);
    this.name = 'FilesError';
    this.code = code;
    this.cause = cause;
    this.aborted = opts?.aborted ?? false;
    this.timedOut = opts?.timedOut ?? false;
    this.permanent = opts?.permanent ?? false;
  }

  static wrap(
    err: unknown,
    fallbackCode: FilesErrorCode = 'Provider',
  ): FilesError {
    if (err instanceof FilesError) {
      return err;
    }
    const message = err instanceof Error ? err.message : String(err);
    return new FilesError(fallbackCode, message, err);
  }
}

export class Files {
  constructor(opts: unknown) {
    mockFiles(opts);
    Object.assign(this, opts as object);
  }
}

export function resetFilesMock(): void {
  mockFiles.mockClear();
}
