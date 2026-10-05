import { parentPort, workerData } from 'node:worker_threads';
import { ImageError } from './image-error';
import { runImage, type ImageRunRequest } from './image-run';

export type ImageWorkerResult =
  | { ok: true; output: Buffer }
  | { ok: false; code: string; message: string };

async function main() {
  const data = workerData as ImageRunRequest;
  try {
    const output = await runImage(data);
    parentPort?.postMessage({ ok: true, output } satisfies ImageWorkerResult);
  } catch (error) {
    const result: ImageWorkerResult =
      error instanceof ImageError
        ? { ok: false, code: error.code, message: error.message }
        : { ok: false, code: 'PARSE_ERROR', message: 'Conversion failed' };
    parentPort?.postMessage(result);
  }
}

if (parentPort) {
  void main();
}
