import { ConvertError } from './codecs/convert-error';
import { runConvert } from './convert-run';

describe('conversion worker pipeline', () => {
  it('converts a JSON array into CSV', () => {
    const output = runConvert(
      Buffer.from('[{"name":"Ada"}]', 'utf8'),
      'json',
      'csv',
    );
    const text = output.toString('utf8');
    expect(text).toContain('name');
    expect(text).toContain('Ada');
  });

  it('rejects broken XML', () => {
    expect(() =>
      runConvert(Buffer.from('<root><item></root>', 'utf8'), 'xml', 'json'),
    ).toThrow(ConvertError);
    try {
      runConvert(Buffer.from('<root><item></root>', 'utf8'), 'xml', 'json');
    } catch (error) {
      expect(error).toBeInstanceOf(ConvertError);
      expect((error as ConvertError).code).toBe('PARSE_ERROR');
    }
  });

  it('rejects an empty XML file', () => {
    expect(() => runConvert(Buffer.from('   ', 'utf8'), 'xml', 'json')).toThrow(
      ConvertError,
    );
  });
});
