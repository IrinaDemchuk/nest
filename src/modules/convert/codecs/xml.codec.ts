import { Injectable } from '@nestjs/common';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { FormatCodec } from './format-codec';
import { ConvertError } from './convert-error';
import type { CanonicalData, ConvertFormat } from './convert.types';
import { assertDepth, decodeUtf8 } from './utf8';

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  processEntities: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
};

@Injectable()
export class XmlCodec extends FormatCodec {
  readonly format: ConvertFormat = 'xml';

  sniff(sample: Buffer, filename?: string): boolean {
    if (filename?.toLowerCase().endsWith('.xml')) {
      return true;
    }
    try {
      return decodeUtf8(sample.subarray(0, 256)).trim().startsWith('<');
    } catch {
      return false;
    }
  }

  parse(input: Buffer): CanonicalData {
    const text = decodeUtf8(input).trim();
    if (text === '') {
      throw new ConvertError('PARSE_ERROR', 'XML file is empty');
    }
    const valid = XMLValidator.validate(text, {
      allowBooleanAttributes: true,
    });
    if (valid !== true) {
      throw new ConvertError('PARSE_ERROR', 'Invalid XML');
    }
    const parser = new XMLParser(PARSER_OPTIONS);
    const data: unknown = parser.parse(text);
    assertDepth(data);
    return data;
  }

  serialize(data: CanonicalData): Buffer {
    const builder = new XMLBuilder({
      ...PARSER_OPTIONS,
      format: true,
      suppressEmptyNode: true,
    });
    const xml = builder.build({ root: data ?? {} });
    return Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`,
      'utf8',
    );
  }
}
