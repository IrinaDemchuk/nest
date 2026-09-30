export const HISTORY_DEFAULT_LIMIT = 20;
export const HISTORY_MIN_LIMIT = 1;
export const HISTORY_MAX_LIMIT = 100;

export const HISTORY_TYPES = ['file', 'image'] as const;
export type HistoryType = (typeof HISTORY_TYPES)[number];

export const HISTORY_FORMATS = [
  'csv',
  'json',
  'xml',
  'yaml',
  'png',
  'jpeg',
  'svg',
] as const;
export type HistoryFormat = (typeof HISTORY_FORMATS)[number];

export const HISTORY_STATUSES = ['success', 'error'] as const;
export type HistoryStatus = (typeof HISTORY_STATUSES)[number];

export const HISTORY_DOWNLOAD_CONTENT_TYPE: Record<string, string> = {
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
  png: 'image/png',
  jpeg: 'image/jpeg',
};
