export const CONVERT_FORMATS = ['csv', 'json', 'xml', 'yaml'] as const;
export type ConvertFormat = (typeof CONVERT_FORMATS)[number];

export type CanonicalData = unknown;

export const CONVERT_EXT: Record<string, ConvertFormat> = {
  csv: 'csv',
  json: 'json',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
};

export const CONVERT_CONTENT_TYPE: Record<ConvertFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
};

export const MAX_STRUCTURE_DEPTH = 32;
