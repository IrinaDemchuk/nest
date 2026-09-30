import { Inject, Injectable } from '@nestjs/common';
import { FormatCodec } from './format-codec';
import { ConvertError } from './convert-error';
import {
  CONVERT_EXT,
  CONVERT_FORMATS,
  type ConvertFormat,
} from './convert.types';

export const FORMAT_CODECS = 'FORMAT_CODECS';

@Injectable()
export class CodecRegistry {
  private readonly byFormat = new Map<ConvertFormat, FormatCodec>();

  constructor(@Inject(FORMAT_CODECS) codecs: FormatCodec[]) {
    for (const codec of codecs) {
      this.byFormat.set(codec.format, codec);
    }
  }

  get(format: ConvertFormat): FormatCodec {
    const codec = this.byFormat.get(format);
    if (!codec) {
      throw new ConvertError(
        'UNSUPPORTED_FORMAT',
        `Unsupported format: ${format}`,
      );
    }
    return codec;
  }

  detect(sample: Buffer, filename?: string): ConvertFormat | null {
    const ext = filename?.split('.').pop()?.toLowerCase();
    const fromExt = ext ? CONVERT_EXT[ext] : undefined;
    if (fromExt) {
      const codec = this.byFormat.get(fromExt);
      if (codec?.sniff(sample, filename)) {
        return codec.format;
      }
    }
    for (const format of CONVERT_FORMATS) {
      const codec = this.byFormat.get(format);
      if (codec?.sniff(sample, filename)) {
        return codec.format;
      }
    }
    return null;
  }

  listPairs(): { source: string; target: string[] }[] {
    return CONVERT_FORMATS.map((source) => ({
      source,
      target: CONVERT_FORMATS.filter((target) => target !== source),
    }));
  }
}
