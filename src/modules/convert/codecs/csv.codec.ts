import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { FormatCodec } from './format-codec';
import { ConvertError } from './convert-error';
import type { CanonicalData, ConvertFormat } from './convert.types';
import { decodeUtf8 } from './utf8';

@Injectable()
export class CsvCodec extends FormatCodec {
  readonly format: ConvertFormat = 'csv';

  sniff(sample: Buffer, filename?: string): boolean {
    if (filename?.toLowerCase().endsWith('.csv')) {
      return true;
    }
    const text = safePreview(sample);
    if (
      !text ||
      text.startsWith('{') ||
      text.startsWith('[') ||
      text.startsWith('<') ||
      text.startsWith('---')
    ) {
      return false;
    }
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    return firstLine.includes(',') || firstLine.includes(';');
  }

  parse(input: Buffer): CanonicalData {
    const text = decodeUtf8(input);
    if (text.trim() === '') {
      return [];
    }
    try {
      const rows = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: false,
        delimiter: this.detectDelimiter(text),
      });
      return rows;
    } catch {
      throw new ConvertError(
        'PARSE_ERROR',
        'Invalid CSV (header row is required)',
      );
    }
  }

  detectDelimiter(text: string): string {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const commas = (firstLine.match(/,/g) ?? []).length;
    const semis = (firstLine.match(/;/g) ?? []).length;
    return semis > commas ? ';' : ',';
  }

  serialize(data: CanonicalData): Buffer {
    if (!Array.isArray(data)) {
      throw new ConvertError(
        'INVALID_STRUCTURE',
        'CSV target requires an array of objects',
      );
    }
    if (data.length === 0) {
      return Buffer.from('', 'utf8');
    }
    if (
      !data.every(
        (row) => row !== null && typeof row === 'object' && !Array.isArray(row),
      )
    ) {
      throw new ConvertError(
        'INVALID_STRUCTURE',
        'CSV target requires an array of objects',
      );
    }
    const rows = data as Record<string, unknown>[];
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const records = data.map((row) => {
      const object = row as Record<string, unknown>;
      return Object.fromEntries(
        columns.map((key) => [key, cellValue(object[key])]),
      );
    });
    return Buffer.from(stringify(records, { header: true, columns }), 'utf8');
  }
}

function cellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value);
    default:
      return JSON.stringify(value) ?? '';
  }
}

function safePreview(sample: Buffer): string {
  try {
    return decodeUtf8(sample.subarray(0, 256)).trim();
  } catch {
    return '';
  }
}
