import { parentPort, workerData } from 'node:worker_threads';
import { ConvertError } from './codecs/convert-error';
import type { ConvertFormat } from './codecs/convert.types';
import { runConvert } from './convert-run';

export interface ConvertWorkerData {
  input: Buffer;
  sourceFormat: ConvertFormat;
  targetFormat: ConvertFormat;
}

export type ConvertWorkerResult =
  | { ok: true; output: Buffer }
  | { ok: false; code: string; message: string };

const data = workerData as ConvertWorkerData;

try {
  const output = runConvert(
    Buffer.from(data.input),
    data.sourceFormat,
    data.targetFormat,
  );
  parentPort?.postMessage({ ok: true, output } satisfies ConvertWorkerResult);
} catch (error) {
  const result: ConvertWorkerResult =
    error instanceof ConvertError
      ? { ok: false, code: error.code, message: error.message }
      : { ok: false, code: 'PARSE_ERROR', message: 'Conversion failed' };
  parentPort?.postMessage(result);
}
