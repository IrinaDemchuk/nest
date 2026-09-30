import type { ReadStream } from 'node:fs';

export abstract class FileStorage {
  abstract save(
    userId: string,
    jobId: string,
    ext: string,
    data: Buffer,
  ): Promise<string>;

  abstract read(relativePath: string): Promise<ReadStream>;

  abstract remove(relativePath: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(
    public readonly code: 'INVALID_PATH' | 'NOT_FOUND' | 'IO',
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
