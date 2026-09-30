import type { CanonicalData, ConvertFormat } from './convert.types';

export abstract class FormatCodec {
  abstract readonly format: ConvertFormat;

  abstract sniff(sample: Buffer, filename?: string): boolean;

  abstract parse(input: Buffer): CanonicalData;

  abstract serialize(data: CanonicalData): Buffer;
}
