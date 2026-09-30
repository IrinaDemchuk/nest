import { ReadStream } from 'node:fs';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { FileStorage, StorageError } from '@/modules/storage/file-storage';
import { formatSaveLog } from '@/modules/storage/save-flag';
import {
  HISTORY_DEFAULT_LIMIT,
  HISTORY_DOWNLOAD_CONTENT_TYPE,
  type HistoryType,
} from './history.constants';
import type { HistoryQueryDto } from './dto/history-query.dto';
import { TransformationSettingsService } from './transformation-settings.service';

const PURGE_INTERVAL_MS = 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TransformationHistoryItem {
  id: string;
  type: HistoryType;
  sourceFormat: string;
  targetFormat: string;
  status: 'success' | 'error';
  saved: boolean;
  fileSize: number;
  durationMs: number;
  errorCode?: string;
  createdAt: Date;
}

export interface TransformationHistoryPage {
  items: TransformationHistoryItem[];
  nextCursor: string | null;
}

export interface TransformationDownload {
  stream: ReadStream;
  contentType: string;
  downloadName: string;
}

interface HistoryCursor {
  createdAt: Date;
  id: string;
}

interface StoredJob {
  id: string;
  outputPath: string | null;
  outputBytes: number | null;
  inputBytes: number;
  targetFormat: string;
  createdAt: Date;
}

@Injectable()
export class HistoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HistoryService.name);
  private purgeTimer: ReturnType<typeof setInterval> | undefined;
  private purging = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: TransformationSettingsService,
    private readonly storage: FileStorage,
  ) {}

  onModuleInit() {
    void this.purgeExpired();
    this.purgeTimer = setInterval(() => {
      void this.purgeExpired();
    }, PURGE_INTERVAL_MS);
    this.purgeTimer.unref();
  }

  onModuleDestroy() {
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
    }
  }

  listForSelf(actorUserId: string, query: HistoryQueryDto) {
    return this.list(actorUserId, actorUserId, query);
  }

  async listForUser(
    actorUserId: string,
    targetUserId: string,
    query: HistoryQueryDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!user) {
      this.log(actorUserId, targetUserId, query, 404, 0);
      throw new NotFoundException('User not found');
    }
    return this.list(actorUserId, targetUserId, query);
  }

  async openForSelf(
    actorUserId: string,
    itemId: string,
  ): Promise<TransformationDownload> {
    const started = Date.now();
    const row = await this.prisma.conversionJob.findUnique({
      where: { id: itemId },
    });
    if (!row) {
      this.logDownload(actorUserId, itemId, null, 404, 0, started);
      throw new NotFoundException('Transformation not found');
    }
    if (row.userId !== actorUserId) {
      this.logDownload(
        actorUserId,
        itemId,
        row.outputPath,
        403,
        row.outputBytes ?? 0,
        started,
      );
      throw new ForbiddenException();
    }
    return this.openStored(actorUserId, row, started);
  }

  async openForUser(
    actorUserId: string,
    targetUserId: string,
    itemId: string,
  ): Promise<TransformationDownload> {
    const started = Date.now();
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!user) {
      this.logDownload(actorUserId, itemId, null, 404, 0, started);
      throw new NotFoundException('User not found');
    }
    const row = await this.prisma.conversionJob.findFirst({
      where: { id: itemId, userId: targetUserId },
    });
    if (!row) {
      this.logDownload(actorUserId, itemId, null, 404, 0, started);
      throw new NotFoundException('Transformation not found');
    }
    return this.openStored(actorUserId, row, started);
  }

  private async list(
    actorUserId: string,
    targetUserId: string,
    query: HistoryQueryDto,
  ): Promise<TransformationHistoryPage> {
    const from = query.createdAtFrom
      ? new Date(query.createdAtFrom)
      : undefined;
    const to = query.createdAtTo ? new Date(query.createdAtTo) : undefined;
    if (from && to && from.getTime() > to.getTime()) {
      this.log(actorUserId, targetUserId, query, 400, 0);
      throw new BadRequestException('createdAtFrom must be before createdAtTo');
    }

    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    if (query.cursor && !cursor) {
      this.log(actorUserId, targetUserId, query, 400, 0);
      throw new BadRequestException('Invalid cursor');
    }

    const limit = query.limit ?? HISTORY_DEFAULT_LIMIT;
    const where = this.where(targetUserId, query, from, to, cursor);
    const rows = await this.prisma.conversionJob.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        kind: true,
        sourceFormat: true,
        targetFormat: true,
        status: true,
        inputBytes: true,
        durationMs: true,
        errorCode: true,
        outputPath: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            }),
            'utf8',
          ).toString('base64url')
        : null;

    this.log(actorUserId, targetUserId, query, 200, page.length);

    return {
      items: page.map((row) => {
        const status = row.status === 'SUCCESS' ? 'success' : 'error';
        const item: TransformationHistoryItem = {
          id: row.id,
          type: historyType(row.kind),
          sourceFormat: row.sourceFormat,
          targetFormat: row.targetFormat,
          status,
          saved: Boolean(row.outputPath),
          fileSize: row.inputBytes,
          durationMs: row.durationMs,
          createdAt: row.createdAt,
        };
        if (status === 'error' && row.errorCode) {
          item.errorCode = row.errorCode;
        }
        return item;
      }),
      nextCursor,
    };
  }

  async purgeExpired(): Promise<void> {
    if (this.purging) {
      return;
    }
    this.purging = true;
    let deleted = 0;
    try {
      const cutoff = this.cutoff();
      for (;;) {
        const batch = await this.prisma.conversionJob.findMany({
          where: { createdAt: { lt: cutoff } },
          orderBy: { createdAt: 'asc' },
          take: 100,
          select: { id: true, outputPath: true },
        });
        if (batch.length === 0) {
          break;
        }
        const removedIds: string[] = [];
        for (const row of batch) {
          if (await this.removeStoredFile(row.outputPath)) {
            removedIds.push(row.id);
          }
        }
        if (removedIds.length === 0) {
          break;
        }
        await this.prisma.conversionJob.deleteMany({
          where: { id: { in: removedIds } },
        });
        deleted += removedIds.length;
      }
      this.logger.log(`event=purge deleted=${deleted} outcome=200`);
    } catch {
      this.logger.error(`event=purge deleted=${deleted} outcome=500`);
    } finally {
      this.purging = false;
    }
  }

  private async openStored(
    actorUserId: string,
    row: StoredJob,
    started: number,
  ): Promise<TransformationDownload> {
    const fileSize = row.outputBytes ?? row.inputBytes;
    const contentType = HISTORY_DOWNLOAD_CONTENT_TYPE[row.targetFormat];
    if (!row.outputPath || !contentType || this.isExpired(row.createdAt)) {
      this.logDownload(
        actorUserId,
        row.id,
        row.outputPath,
        404,
        fileSize,
        started,
      );
      throw new NotFoundException('Stored file not found');
    }
    try {
      const stream = await this.storage.read(row.outputPath);
      this.logDownload(
        actorUserId,
        row.id,
        row.outputPath,
        200,
        fileSize,
        started,
      );
      return {
        stream,
        contentType,
        downloadName: `converted.${row.targetFormat}`,
      };
    } catch (error) {
      if (error instanceof StorageError && error.code === 'IO') {
        this.logDownload(
          actorUserId,
          row.id,
          row.outputPath,
          500,
          fileSize,
          started,
        );
        throw new InternalServerErrorException('Failed to read stored file');
      }
      this.logDownload(
        actorUserId,
        row.id,
        row.outputPath,
        404,
        fileSize,
        started,
      );
      throw new NotFoundException('Stored file not found');
    }
  }

  private async removeStoredFile(outputPath: string | null): Promise<boolean> {
    if (!outputPath) {
      return true;
    }
    try {
      await this.storage.remove(outputPath);
      return true;
    } catch (error) {
      if (error instanceof StorageError && error.code !== 'IO') {
        this.logger.warn(`event=purge fileId=${outputPath} outcome=skip`);
        return true;
      }
      this.logger.error(`event=purge fileId=${outputPath} outcome=500`);
      return false;
    }
  }

  private cutoff(): Date {
    const retentionMs = this.settings.getRetentionDays() * MS_PER_DAY;
    return new Date(Date.now() - retentionMs);
  }

  private isExpired(createdAt: Date): boolean {
    return createdAt.getTime() < this.cutoff().getTime();
  }

  private logDownload(
    userId: string,
    transformationId: string,
    fileId: string | null,
    outcome: number,
    fileSize: number,
    started: number,
  ) {
    this.logger.log(
      formatSaveLog({
        userId,
        transformationId,
        fileId,
        action: 'download',
        outcome,
        fileSize,
        durationMs: Date.now() - started,
      }),
    );
  }

  private where(
    userId: string,
    query: HistoryQueryDto,
    from: Date | undefined,
    to: Date | undefined,
    cursor: HistoryCursor | undefined,
  ): Prisma.ConversionJobWhereInput {
    const and: Prisma.ConversionJobWhereInput[] = [];
    if (from || to) {
      and.push({
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      });
    }
    if (cursor) {
      and.push({
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      });
    }
    return {
      userId,
      ...(query.type ? { kind: query.type } : {}),
      ...(query.sourceFormat ? { sourceFormat: query.sourceFormat } : {}),
      ...(query.targetFormat ? { targetFormat: query.targetFormat } : {}),
      ...(query.status
        ? { status: query.status === 'success' ? 'SUCCESS' : 'ERROR' }
        : {}),
      ...(and.length > 0 ? { AND: and } : {}),
    };
  }

  private log(
    actorUserId: string,
    targetUserId: string,
    query: HistoryQueryDto,
    outcome: number,
    count: number,
  ) {
    this.logger.log(
      `actorUserId=${actorUserId} targetUserId=${targetUserId} type=${query.type ?? ''} sourceFormat=${query.sourceFormat ?? ''} targetFormat=${query.targetFormat ?? ''} status=${query.status ?? ''} outcome=${outcome} count=${count}`,
    );
  }
}

function historyType(kind: unknown): HistoryType {
  return kind === 'image' ? 'image' : 'file';
}

function decodeCursor(raw: string): HistoryCursor | undefined {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.createdAt !== 'string' || typeof record.id !== 'string') {
      return undefined;
    }
    if (!UUID_RE.test(record.id)) {
      return undefined;
    }
    const createdAt = new Date(record.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return undefined;
    }
    return { createdAt, id: record.id };
  } catch {
    return undefined;
  }
}
