import { Injectable } from '@nestjs/common';
import { parse, stringify } from 'yaml';
import { FormatCodec } from './format-codec';
import { ConvertError } from './convert-error';
import type { CanonicalData, ConvertFormat } from './convert.types';
import { assertDepth, decodeUtf8 } from './utf8';

@Injectable()
export class YamlCodec extends FormatCodec {
  readonly format: ConvertFormat = 'yaml';

  sniff(sample: Buffer, filename?: string): boolean {
    const lower = filename?.toLowerCase() ?? '';
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
      return true;
    }
    try {
      return decodeUtf8(sample.subarray(0, 256)).trim().startsWith('---');
    } catch {
      return false;
    }
  }

  parse(input: Buffer): CanonicalData {
    const text = decodeUtf8(input);
    if (text.trim() === '') {
      return null;
    }
    try {
      const data: unknown = parse(text, {
        prettyErrors: true,
        maxAliasCount: 50,
      });
      assertDepth(data);
      return data;
    } catch (error) {
      if (error instanceof ConvertError) {
        throw error;
      }
      throw new ConvertError('PARSE_ERROR', 'Invalid YAML');
    }
  }

  serialize(data: CanonicalData): Buffer {
    return Buffer.from(stringify(data), 'utf8');
  }
}
