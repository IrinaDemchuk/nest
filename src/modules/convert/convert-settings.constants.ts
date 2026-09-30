export const CONVERT_SETTING_KEYS = {
  maxBytesCsv: 'convert.maxBytes.csv',
  maxBytesJson: 'convert.maxBytes.json',
  maxBytesXml: 'convert.maxBytes.xml',
  maxBytesYaml: 'convert.maxBytes.yaml',
  timeoutMs: 'convert.timeoutMs',
} as const;

export const CONVERT_SETTING_DEFAULTS: Record<string, string> = {
  [CONVERT_SETTING_KEYS.maxBytesCsv]: '5242880',
  [CONVERT_SETTING_KEYS.maxBytesJson]: '5242880',
  [CONVERT_SETTING_KEYS.maxBytesXml]: '5242880',
  [CONVERT_SETTING_KEYS.maxBytesYaml]: '5242880',
  [CONVERT_SETTING_KEYS.timeoutMs]: '30000',
};
