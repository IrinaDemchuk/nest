import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  TRANSFORMATION_RETENTION_DEFAULT_DAYS,
  TRANSFORMATION_RETENTION_MAX_DAYS,
  TRANSFORMATION_RETENTION_MIN_DAYS,
  TRANSFORMATION_SETTING_DEFAULTS,
  TRANSFORMATION_SETTING_KEYS,
} from './transformation-settings.constants';

@Injectable()
export class TransformationSettingsService implements OnModuleInit {
  private readonly logger = new Logger(TransformationSettingsService.name);
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const defaults = Object.entries(TRANSFORMATION_SETTING_DEFAULTS);
    for (const [key, value] of defaults) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: {},
      });
    }
    await this.reload();
    this.logger.log(
      'Transformation system settings seeded (missing keys only)',
    );
  }

  async reload() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'transformations.' } },
    });
    this.cache = new Map(rows.map((row) => [row.key, row.value]));
  }

  getRetentionDays(): number {
    const fallback =
      TRANSFORMATION_SETTING_DEFAULTS[
        TRANSFORMATION_SETTING_KEYS.retentionDays
      ];
    const parsed = Number.parseInt(
      this.cache.get(TRANSFORMATION_SETTING_KEYS.retentionDays) ?? fallback,
      10,
    );
    if (
      !Number.isInteger(parsed) ||
      parsed < TRANSFORMATION_RETENTION_MIN_DAYS ||
      parsed > TRANSFORMATION_RETENTION_MAX_DAYS
    ) {
      return TRANSFORMATION_RETENTION_DEFAULT_DAYS;
    }
    return parsed;
  }

  getAll() {
    return { retentionDays: this.getRetentionDays() };
  }

  async updateRetentionDays(retentionDays: number) {
    const value = String(retentionDays);
    await this.prisma.systemSetting.upsert({
      where: { key: TRANSFORMATION_SETTING_KEYS.retentionDays },
      create: { key: TRANSFORMATION_SETTING_KEYS.retentionDays, value },
      update: { value },
    });
    await this.reload();
    this.logger.log('event=transformation-settings-updated outcome=200');
    return this.getAll();
  }
}
