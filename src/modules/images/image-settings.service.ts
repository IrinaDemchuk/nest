import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  IMAGE_SETTING_DEFAULTS,
  IMAGE_SETTING_KEYS,
  type ImageSourceFormat,
} from './image-settings.constants';

const MAX_BYTES_KEYS: Record<ImageSourceFormat, string> = {
  png: IMAGE_SETTING_KEYS.maxBytesPng,
  jpeg: IMAGE_SETTING_KEYS.maxBytesJpeg,
  svg: IMAGE_SETTING_KEYS.maxBytesSvg,
};

@Injectable()
export class ImageSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ImageSettingsService.name);
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const [key, value] of Object.entries(IMAGE_SETTING_DEFAULTS)) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: {},
      });
    }
    await this.reload();
    this.logger.log('Image system settings seeded (missing keys only)');
  }

  async reload() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'images.' } },
    });
    this.cache = new Map(rows.map((row) => [row.key, row.value]));
  }

  getMaxBytes(format: ImageSourceFormat): number {
    return this.readInt(
      MAX_BYTES_KEYS[format],
      IMAGE_SETTING_DEFAULTS[MAX_BYTES_KEYS[format]],
    );
  }

  getMaxWidth(): number {
    return this.readInt(
      IMAGE_SETTING_KEYS.maxWidth,
      IMAGE_SETTING_DEFAULTS[IMAGE_SETTING_KEYS.maxWidth],
    );
  }

  getMaxHeight(): number {
    return this.readInt(
      IMAGE_SETTING_KEYS.maxHeight,
      IMAGE_SETTING_DEFAULTS[IMAGE_SETTING_KEYS.maxHeight],
    );
  }

  getTimeoutMs(): number {
    return this.readInt(
      IMAGE_SETTING_KEYS.timeoutMs,
      IMAGE_SETTING_DEFAULTS[IMAGE_SETTING_KEYS.timeoutMs],
    );
  }

  private readInt(key: string, fallback: string): number {
    const parsed = Number.parseInt(this.cache.get(key) ?? fallback, 10);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : Number.parseInt(fallback, 10);
  }

  getAll() {
    return {
      png: this.getMaxBytes('png'),
      jpeg: this.getMaxBytes('jpeg'),
      svg: this.getMaxBytes('svg'),
      maxWidth: this.getMaxWidth(),
      maxHeight: this.getMaxHeight(),
      timeoutMs: this.getTimeoutMs(),
    };
  }

  async updateSettings(input: {
    png: number;
    jpeg: number;
    svg: number;
    maxWidth: number;
    maxHeight: number;
    timeoutMs?: number;
  }) {
    const entries: [string, string][] = [
      [IMAGE_SETTING_KEYS.maxBytesPng, String(input.png)],
      [IMAGE_SETTING_KEYS.maxBytesJpeg, String(input.jpeg)],
      [IMAGE_SETTING_KEYS.maxBytesSvg, String(input.svg)],
      [IMAGE_SETTING_KEYS.maxWidth, String(input.maxWidth)],
      [IMAGE_SETTING_KEYS.maxHeight, String(input.maxHeight)],
    ];
    if (input.timeoutMs !== undefined) {
      entries.push([IMAGE_SETTING_KEYS.timeoutMs, String(input.timeoutMs)]);
    }
    for (const [key, value] of entries) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    await this.reload();
    this.logger.log('event=image-settings-updated outcome=200');
    return this.getAll();
  }
}
