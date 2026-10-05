import { parentPort, workerData } from 'node:worker_threads';
import { readFileStream } from '../../common/spill-stream';
import { ConvertError } from './codecs/convert-error';
import type { ConvertFormat } from './codecs/convert.types';
import { runConvert } from './convert-run';

export interface ConvertWorkerData {
  inputPath: string;
  sourceFormat: ConvertFormat;
  targetFormat: ConvertFormat;
}

export type ConvertWorkerResult =
  | { ok: true; output: Buffer }
  | { ok: false; code: string; message: string };

async function main() {
  const data = workerData as ConvertWorkerData;
  try {
    const input = await readFileStream(data.inputPath);
    const output = runConvert(input, data.sourceFormat, data.targetFormat);
    parentPort?.postMessage({ ok: true, output } satisfies ConvertWorkerResult);
  } catch (error) {
    const result: ConvertWorkerResult =
      error instanceof ConvertError
        ? { ok: false, code: error.code, message: error.message }
        : { ok: false, code: 'PARSE_ERROR', message: 'Conversion failed' };
    parentPort?.postMessage(result);
  }
}

void main();
