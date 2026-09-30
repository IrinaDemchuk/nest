import { CsvCodec } from './codecs/csv.codec';
import { JsonCodec } from './codecs/json.codec';
import { XmlCodec } from './codecs/xml.codec';
import { YamlCodec } from './codecs/yaml.codec';
import type { ConvertFormat } from './codecs/convert.types';
import { FormatCodec } from './codecs/format-codec';

function createCodec(format: ConvertFormat): FormatCodec {
  switch (format) {
    case 'csv':
      return new CsvCodec();
    case 'json':
      return new JsonCodec();
    case 'xml':
      return new XmlCodec();
    case 'yaml':
      return new YamlCodec();
  }
}

export function runConvert(
  input: Buffer,
  sourceFormat: ConvertFormat,
  targetFormat: ConvertFormat,
): Buffer {
  const data = createCodec(sourceFormat).parse(input);
  return createCodec(targetFormat).serialize(data);
}
