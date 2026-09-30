import { Injectable } from '@nestjs/common';
import { FormatCodec } from './format-codec';
import { ConvertError } from './convert-error';
import type { CanonicalData, ConvertFormat } from './convert.types';
import { assertDepth, decodeUtf8 } from './utf8';

@Injectable()
export class JsonCodec extends FormatCodec {
  readonly format: ConvertFormat = 'json';

  sniff(sample: Buffer, filename?: string): boolean {
    if (filename?.toLowerCase().endsWith('.json')) {
      return true;
    }
    const text = safePreview(sample);
    return text.startsWith('{') || text.startsWith('[');
  }

  parse(input: Buffer): CanonicalData {
    const text = decodeUtf8(input).trim();
    if (text === '') {
      throw new ConvertError('PARSE_ERROR', 'JSON file is empty');
    }
    try {
      const data: unknown = JSON.parse(text);
      assertDepth(data);
      return data;
    } catch (error) {
      if (error instanceof ConvertError) {
        throw error;
      }
      throw new ConvertError('PARSE_ERROR', 'Invalid JSON');
    }
  }

  serialize(data: CanonicalData): Buffer {
    return Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
}

function safePreview(sample: Buffer): string {
  try {
    return decodeUtf8(sample.subarray(0, 256)).trim();
  } catch {
    return '';
  }
}
