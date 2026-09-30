export const IMAGE_FORMATS = ['png', 'jpeg', 'svg'] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const IMAGE_RASTER_FORMATS = ['png', 'jpeg'] as const;
export type ImageRasterFormat = (typeof IMAGE_RASTER_FORMATS)[number];

export const IMAGE_PAIRS: Record<ImageFormat, readonly ImageRasterFormat[]> = {
  png: ['jpeg'],
  jpeg: ['png'],
  svg: ['png', 'jpeg'],
};

export const IMAGE_CONTENT_TYPE: Record<ImageRasterFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
};

export const IMAGE_EXT: Record<string, ImageFormat> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  svg: 'svg',
};

export const DEFAULT_JPEG_QUALITY = 80;
export const DEFAULT_SVG_SIZE = 1024;

const SVG_SNIFF_BYTES = 64 * 1024;
const SVG_HINTED_SNIFF_BYTES = 256 * 1024;

export function sniffImage(
  sample: Buffer,
  filename?: string,
): ImageFormat | null {
  if (isPng(sample)) {
    return 'png';
  }
  if (isJpeg(sample)) {
    return 'jpeg';
  }
  const hintedSvg = extensionOf(filename) === 'svg';
  const window = sample.subarray(
    0,
    hintedSvg ? SVG_HINTED_SNIFF_BYTES : SVG_SNIFF_BYTES,
  );
  if (hasSvgRoot(window)) {
    return 'svg';
  }
  return null;
}

function extensionOf(filename?: string): string | undefined {
  const ext = filename?.split('.').pop()?.toLowerCase();
  return ext && IMAGE_EXT[ext] ? IMAGE_EXT[ext] : undefined;
}

function isPng(sample: Buffer): boolean {
  return (
    sample.length >= 8 &&
    sample[0] === 0x89 &&
    sample[1] === 0x50 &&
    sample[2] === 0x4e &&
    sample[3] === 0x47 &&
    sample[4] === 0x0d &&
    sample[5] === 0x0a &&
    sample[6] === 0x1a &&
    sample[7] === 0x0a
  );
}

function isJpeg(sample: Buffer): boolean {
  return (
    sample.length >= 3 &&
    sample[0] === 0xff &&
    sample[1] === 0xd8 &&
    sample[2] === 0xff
  );
}

function hasSvgRoot(sample: Buffer): boolean {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(sample);
  } catch {
    return false;
  }
  let rest = text.replace(/^\uFEFF/, '').trimStart();
  if (rest.startsWith('<?xml')) {
    const end = rest.indexOf('?>');
    if (end === -1) {
      return false;
    }
    rest = rest.slice(end + 2).trimStart();
  }
  rest = rest.replace(/^(?:<!--[\s\S]*?-->\s*)+/, '').trimStart();
  return /^<svg(\s|\/|>)/i.test(rest);
}
