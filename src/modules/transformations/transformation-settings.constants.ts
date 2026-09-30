export const TRANSFORMATION_SETTING_KEYS = {
  retentionDays: 'transformations.retentionDays',
} as const;

export const TRANSFORMATION_RETENTION_DEFAULT_DAYS = 90;

export const TRANSFORMATION_SETTING_DEFAULTS: Record<string, string> = {
  [TRANSFORMATION_SETTING_KEYS.retentionDays]: String(
    TRANSFORMATION_RETENTION_DEFAULT_DAYS,
  ),
};

export const TRANSFORMATION_RETENTION_MIN_DAYS = 1;
export const TRANSFORMATION_RETENTION_MAX_DAYS = 365;
