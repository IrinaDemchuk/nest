import { ConvertError } from './convert-error';
import { MAX_STRUCTURE_DEPTH } from './convert.types';

export function decodeUtf8(input: Buffer): string {
  const start =
    input.length >= 3 &&
    input[0] === 0xef &&
    input[1] === 0xbb &&
    input[2] === 0xbf
      ? 3
      : 0;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      input.subarray(start),
    );
  } catch {
    throw new ConvertError('INVALID_ENCODING', 'File must be UTF-8');
  }
}

export function assertDepth(value: unknown, depth = 0): void {
  if (depth > MAX_STRUCTURE_DEPTH) {
    throw new ConvertError(
      'STRUCTURE_TOO_DEEP',
      `Structure exceeds ${MAX_STRUCTURE_DEPTH} levels`,
    );
  }
  if (value !== null && typeof value === 'object') {
    const children = Array.isArray(value) ? value : Object.values(value);
    for (const child of children) {
      assertDepth(child, depth + 1);
    }
  }
}
