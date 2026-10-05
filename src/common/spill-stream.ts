import { createReadStream, createWriteStream } from 'node:fs';
import { open, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

export interface SpilledFile {
  dir: string;
  path: string;
  bytes: number;
}

export async function spillStream(source: Readable): Promise<SpilledFile> {
  const dir = await mkdtemp(join(tmpdir(), 'transform-'));
  const path = join(dir, randomUUID());
  let bytes = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buf.length;
      callback(null, buf);
    },
  });
  try {
    await pipeline(source, counter, createWriteStream(path));
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, path, bytes };
}

export async function removeSpill(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function readFileHead(
  path: string,
  maxBytes: number,
): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function readFileStream(path: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = createReadStream(path, { highWaterMark: 64 * 1024 });
  for await (const chunk of stream) {
    const view =
      chunk instanceof Uint8Array
        ? new Uint8Array(chunk)
        : new TextEncoder().encode(String(chunk));
    chunks.push(Buffer.from(view));
  }
  return Buffer.concat(chunks);
}
