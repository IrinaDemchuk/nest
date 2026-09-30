import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  CONVERT_SETTING_DEFAULTS,
  CONVERT_SETTING_KEYS,
} from './convert-settings.constants';
import type { ConvertFormat } from './codecs/convert.types';

const MAX_BYTES_KEYS: Record<ConvertFormat, string> = {
  csv: CONVERT_SETTING_KEYS.maxBytesCsv,
  json: CONVERT_SETTING_KEYS.maxBytesJson,
  xml: CONVERT_SETTING_KEYS.maxBytesXml,
  yaml: CONVERT_SETTING_KEYS.maxBytesYaml,
};

@Injectable()
export class ConvertSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ConvertSettingsService.name);
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const [key, value] of Object.entries(CONVERT_SETTING_DEFAULTS)) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: {},
      });
    }
    await this.reload();
    this.logger.log('Convert system settings seeded (missing keys only)');
  }

  async reload() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'convert.' } },
    });
    this.cache = new Map(rows.map((row) => [row.key, row.value]));
  }

  getMaxBytes(format: ConvertFormat): number {
    return this.readInt(
      MAX_BYTES_KEYS[format],
      CONVERT_SETTING_DEFAULTS[MAX_BYTES_KEYS[format]],
    );
  }

  getTimeoutMs(): number {
    return this.readInt(
      CONVERT_SETTING_KEYS.timeoutMs,
      CONVERT_SETTING_DEFAULTS[CONVERT_SETTING_KEYS.timeoutMs],
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
      csv: this.getMaxBytes('csv'),
      json: this.getMaxBytes('json'),
      xml: this.getMaxBytes('xml'),
      yaml: this.getMaxBytes('yaml'),
      timeoutMs: this.getTimeoutMs(),
    };
  }

  async updateMaxBytes(input: {
    csv: number;
    json: number;
    xml: number;
    yaml: number;
    timeoutMs?: number;
  }) {
    const entries: [string, string][] = [
      [CONVERT_SETTING_KEYS.maxBytesCsv, String(input.csv)],
      [CONVERT_SETTING_KEYS.maxBytesJson, String(input.json)],
      [CONVERT_SETTING_KEYS.maxBytesXml, String(input.xml)],
      [CONVERT_SETTING_KEYS.maxBytesYaml, String(input.yaml)],
    ];
    if (input.timeoutMs !== undefined) {
      entries.push([CONVERT_SETTING_KEYS.timeoutMs, String(input.timeoutMs)]);
    }
    for (const [key, value] of entries) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    await this.reload();
    this.logger.log('event=convert-settings-updated outcome=200');
    return this.getAll();
  }
}
