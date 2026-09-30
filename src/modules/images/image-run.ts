import sharpImport from 'sharp';
import { ImageError } from './image-error';
import {
  DEFAULT_SVG_SIZE,
  type ImageFormat,
  type ImageRasterFormat,
} from './image.types';

interface SharpInputOptions {
  limitInputPixels?: number;
  animated?: boolean;
  failOn?: 'error';
  density?: number;
}

interface SharpPipeline {
  metadata(): Promise<{ width?: number; height?: number }>;
  flatten(options: { background: string }): SharpPipeline;
  resize(
    width: number,
    height: number,
    options: { fit: 'fill' },
  ): SharpPipeline;
  jpeg(options: { quality: number }): SharpPipeline;
  png(): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}

const sharp = sharpImport as (
  input: Buffer,
  options?: SharpInputOptions,
) => SharpPipeline;

export interface ImageRunRequest {
  input: Buffer;
  sourceFormat: ImageFormat;
  targetFormat: ImageRasterFormat;
  quality: number;
  width: number | null;
  height: number | null;
  background: string;
  maxWidth: number;
  maxHeight: number;
}

const SVG_UNSAFE: RegExp[] = [
  /<!DOCTYPE/i,
  /<!ENTITY/i,
  /\bSYSTEM\b/i,
  /<script/i,
  /\bon[a-z]+\s*=/i,
  /javascript:/i,
  /<(?:foreignObject|iframe|embed|object)\b/i,
  /(?:xlink:href|\bhref)\s*=\s*(?:(['"])\s*(?:https?:|file:|\/\/)|(?:https?:|file:|\/\/))/i,
  /url\(\s*(['"])?\s*(?:https?:|file:|\/\/)/i,
];

export async function runImage(request: ImageRunRequest): Promise<Buffer> {
  if (request.sourceFormat === 'svg') {
    return rasterizeSvg(request);
  }
  return convertRaster(request);
}

export function assertSvgSafe(svg: string): void {
  if (SVG_UNSAFE.some((pattern) => pattern.test(svg))) {
    throw new ImageError('UNSAFE_SVG', 'SVG contains unsafe content');
  }
}

async function convertRaster(request: ImageRunRequest): Promise<Buffer> {
  const options = sharpOptions(request);
  try {
    const meta = await sharp(request.input, options).metadata();
    if (!meta.width || !meta.height) {
      throw new ImageError('PARSE_ERROR', 'Invalid image');
    }
    if (meta.width > request.maxWidth || meta.height > request.maxHeight) {
      throw new ImageError(
        'RASTER_TOO_LARGE',
        'Image dimensions exceed the maximum',
      );
    }
    const image = sharp(request.input, options);
    if (request.targetFormat === 'jpeg') {
      return await image
        .flatten({ background: request.background })
        .jpeg({ quality: request.quality })
        .toBuffer();
    }
    return await image.png().toBuffer();
  } catch (error) {
    throw asImageError(error);
  }
}

async function rasterizeSvg(request: ImageRunRequest): Promise<Buffer> {
  const svg = decodeSvg(request.input);
  assertSvgSafe(svg);
  const size = resolveOutputSize(
    svg,
    request.width,
    request.height,
    request.maxWidth,
    request.maxHeight,
  );
  const sized = forceSvgPixelSize(svg, size.width, size.height);
  try {
    let pipeline = sharp(Buffer.from(sized), {
      ...sharpOptions(request),
      density: 72,
    })
      .resize(size.width, size.height, { fit: 'fill' })
      .flatten({ background: request.background });
    pipeline =
      request.targetFormat === 'jpeg'
        ? pipeline.jpeg({ quality: request.quality })
        : pipeline.png();
    return await pipeline.toBuffer();
  } catch (error) {
    throw asImageError(error);
  }
}

function sharpOptions(request: ImageRunRequest): SharpInputOptions {
  return {
    limitInputPixels: request.maxWidth * request.maxHeight,
    animated: false,
    failOn: 'error',
  };
}

function decodeSvg(input: Buffer): string {
  const start =
    input.length >= 3 &&
    input[0] === 0xef &&
    input[1] === 0xbb &&
    input[2] === 0xbf
      ? 3
      : 0;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      input.subarray(start),
    );
  } catch {
    throw new ImageError('PARSE_ERROR', 'SVG must be UTF-8');
  }
}

function resolveOutputSize(
  svg: string,
  requestedWidth: number | null,
  requestedHeight: number | null,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const intrinsic = readIntrinsicSize(svg);
  let width = requestedWidth ?? intrinsic?.width;
  let height = requestedHeight ?? intrinsic?.height;

  if (width === undefined && height === undefined) {
    width = DEFAULT_SVG_SIZE;
    height = DEFAULT_SVG_SIZE;
  } else if (width === undefined && height !== undefined && intrinsic) {
    width = Math.max(
      1,
      Math.round((height * intrinsic.width) / intrinsic.height),
    );
  } else if (height === undefined && width !== undefined && intrinsic) {
    height = Math.max(
      1,
      Math.round((width * intrinsic.height) / intrinsic.width),
    );
  } else {
    width = width ?? DEFAULT_SVG_SIZE;
    height = height ?? DEFAULT_SVG_SIZE;
  }

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > maxWidth ||
    height > maxHeight
  ) {
    throw new ImageError(
      'RASTER_TOO_LARGE',
      'Output size exceeds the maximum dimensions',
    );
  }
  return { width, height };
}

function readIntrinsicSize(
  svg: string,
): { width: number; height: number } | null {
  const tag = /<svg\b([^>]*)>/i.exec(svg)?.[1];
  if (tag === undefined) {
    return null;
  }
  const width = parseLength(attr(tag, 'width'));
  const height = parseLength(attr(tag, 'height'));
  const box = parseViewBox(attr(tag, 'viewBox'));
  if (width && height) {
    return { width, height };
  }
  if (box) {
    if (width) {
      return {
        width,
        height: Math.max(1, Math.round((width * box.height) / box.width)),
      };
    }
    if (height) {
      return {
        width: Math.max(1, Math.round((height * box.width) / box.height)),
        height,
      };
    }
    return box;
  }
  return null;
}

function attr(tag: string, name: string): string | undefined {
  const match = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  ).exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function parseLength(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = /^(\d+(?:\.\d+)?)(px)?$/i.exec(value.trim());
  if (!match) {
    return null;
  }
  const parsed = Math.round(Number(match[1]));
  return parsed > 0 ? parsed : null;
}

function parseViewBox(
  value: string | undefined,
): { width: number; height: number } | null {
  if (!value) {
    return null;
  }
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isFinite(part)) ||
    parts[2] <= 0 ||
    parts[3] <= 0
  ) {
    return null;
  }
  return { width: Math.round(parts[2]), height: Math.round(parts[3]) };
}

function forceSvgPixelSize(svg: string, width: number, height: number): string {
  const match = /<svg\b([^>]*?)(\/?)\s*>/i.exec(svg);
  if (!match) {
    throw new ImageError('PARSE_ERROR', 'Invalid SVG');
  }
  const attrs = match[1].replace(
    /\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    '',
  );
  const opening = `<svg${attrs} width="${width}" height="${height}">`;
  return (
    svg.slice(0, match.index) +
    opening +
    svg.slice(match.index + match[0].length)
  );
}

function asImageError(error: unknown): ImageError {
  if (error instanceof ImageError) {
    return error;
  }
  const message = error instanceof Error ? error.message : '';
  if (/pixel limit/i.test(message)) {
    return new ImageError(
      'RASTER_TOO_LARGE',
      'Image dimensions exceed the maximum',
    );
  }
  return new ImageError('PARSE_ERROR', 'Invalid image');
}
