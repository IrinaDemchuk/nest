import type { ImageFormat } from './image.types';

export type ImageSourceFormat = ImageFormat;

export const IMAGE_SETTING_KEYS = {
  maxBytesPng: 'images.maxBytes.png',
  maxBytesJpeg: 'images.maxBytes.jpeg',
  maxBytesSvg: 'images.maxBytes.svg',
  maxWidth: 'images.maxWidth',
  maxHeight: 'images.maxHeight',
  timeoutMs: 'images.timeoutMs',
} as const;

export const IMAGE_SETTING_DEFAULTS: Record<string, string> = {
  [IMAGE_SETTING_KEYS.maxBytesPng]: '5242880',
  [IMAGE_SETTING_KEYS.maxBytesJpeg]: '5242880',
  [IMAGE_SETTING_KEYS.maxBytesSvg]: '5242880',
  [IMAGE_SETTING_KEYS.maxWidth]: '4096',
  [IMAGE_SETTING_KEYS.maxHeight]: '4096',
  [IMAGE_SETTING_KEYS.timeoutMs]: '30000',
};
