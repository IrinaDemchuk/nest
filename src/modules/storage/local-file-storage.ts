import { createReadStream, type ReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { FileStorage, StorageError } from './file-storage';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXT_RE = /^(csv|json|xml|yaml|png|jpeg)$/;

const RELATIVE_PATH_RE =
  /^transformations\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(csv|json|xml|yaml|png|jpeg)$/i;

const STORAGE_ROOT = join(process.cwd(), 'storage');
const TRANSFORMATIONS_ROOT = join(STORAGE_ROOT, 'transformations');

@Injectable()
export class LocalFileStorage extends FileStorage {
  async save(
    userId: string,
    jobId: string,
    ext: string,
    data: Buffer,
  ): Promise<string> {
    if (!UUID_RE.test(userId) || !UUID_RE.test(jobId) || !EXT_RE.test(ext)) {
      throw new StorageError('INVALID_PATH', 'Invalid storage path');
    }
    const relativePath = `transformations/${userId}/${jobId}.${ext}`;
    const absolutePath = this.resolveSafe(relativePath);
    try {
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, data);
    } catch {
      throw new StorageError('IO', 'Failed to store file');
    }
    return relativePath;
  }

  async read(relativePath: string): Promise<ReadStream> {
    const absolutePath = this.resolveSafe(relativePath);
    try {
      await access(absolutePath);
    } catch {
      throw new StorageError('NOT_FOUND', 'Stored file not found');
    }
    return createReadStream(absolutePath);
  }

  async remove(relativePath: string): Promise<void> {
    const absolutePath = this.resolveSafe(relativePath);
    try {
      await rm(absolutePath, { force: true });
    } catch {
      throw new StorageError('IO', 'Failed to remove file');
    }
  }

  private resolveSafe(relativePath: string): string {
    const normalized = relativePath.replaceAll('\\', '/');
    if (!RELATIVE_PATH_RE.test(normalized)) {
      throw new StorageError('INVALID_PATH', 'Invalid storage path');
    }
    const absolutePath = join(STORAGE_ROOT, ...normalized.split('/'));
    if (!absolutePath.startsWith(TRANSFORMATIONS_ROOT + sep)) {
      throw new StorageError('INVALID_PATH', 'Invalid storage path');
    }
    return absolutePath;
  }
}
