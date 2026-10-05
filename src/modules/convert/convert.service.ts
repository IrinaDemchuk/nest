import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  PayloadTooLargeException,
  RequestTimeoutException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { readFileHead } from '@/common/spill-stream';
import { PrismaService } from '@/core/prisma/prisma.service';
import { CodecRegistry } from './codecs/codec-registry';
import { ConvertError } from './codecs/convert-error';
import {
  CONVERT_CONTENT_TYPE,
  CONVERT_FORMATS,
  type ConvertFormat,
} from './codecs/convert.types';
import { ConvertSettingsService } from './convert-settings.service';
import type { ConvertWorkerResult } from './convert.worker';
import { FileStorage, StorageError } from '@/modules/storage/file-storage';
import { formatSaveLog } from '@/modules/storage/save-flag';

export interface ConvertInput {
  userId: string;
  path: string;
  byteLength: number;
  filename?: string;
  targetFormat: string;
  persist: boolean;
}

export interface ConvertOutput {
  buffer: Buffer;
  contentType: string;
  downloadName: string;
  jobId: string;
}

@Injectable()
export class ConvertService {
  private readonly logger = new Logger(ConvertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codecs: CodecRegistry,
    private readonly settings: ConvertSettingsService,
    private readonly storage: FileStorage,
  ) {}

  async convert(input: ConvertInput): Promise<ConvertOutput> {
    const started = Date.now();
    const targetFormat = this.parseTarget(input.targetFormat);
    const persist = input.persist;
    const inputBytes = input.byteLength;

    let sourceFormat: ConvertFormat | 'unknown' = 'unknown';
    let errorCode: string | undefined;
    let jobId: string | undefined;

    try {
      if (inputBytes === 0) {
        throw new ConvertError('PARSE_ERROR', 'File is empty');
      }

      const head = await readFileHead(input.path, 8192);
      const detected = this.codecs.detect(head, input.filename);
      if (!detected) {
        throw new ConvertError(
          'UNSUPPORTED_FORMAT',
          'Unsupported source format',
        );
      }
      sourceFormat = detected;

      if (sourceFormat === targetFormat) {
        throw new ConvertError(
          'SAME_FORMAT',
          'Source and target format must differ',
        );
      }

      const maxBytes = this.settings.getMaxBytes(sourceFormat);
      if (inputBytes > maxBytes) {
        throw new ConvertError(
          'PAYLOAD_TOO_LARGE',
          'File exceeds size limit for source format',
        );
      }

      const output = await this.runInWorker(
        input.path,
        sourceFormat,
        targetFormat,
        this.settings.getTimeoutMs(),
      );

      jobId = randomUUID();
      let outputPath: string | null = null;
      if (persist) {
        try {
          outputPath = await this.storage.save(
            input.userId,
            jobId,
            targetFormat,
            output,
          );
          this.logSave(
            input.userId,
            jobId,
            outputPath,
            200,
            output.byteLength,
            started,
          );
        } catch (error) {
          this.logSave(
            input.userId,
            jobId,
            null,
            this.mapError(error).getStatus(),
            output.byteLength,
            started,
          );
          throw error;
        }
      }

      const durationMs = Date.now() - started;
      await this.prisma.conversionJob.create({
        data: {
          id: jobId,
          userId: input.userId,
          kind: 'file',
          sourceFormat,
          targetFormat,
          inputFilename: input.filename ?? null,
          inputBytes,
          outputBytes: output.byteLength,
          status: 'SUCCESS',
          persistRequested: persist,
          outputPath,
          durationMs,
        },
      });

      this.logger.log(
        `userId=${input.userId} event=convert sourceFormat=${sourceFormat} targetFormat=${targetFormat} fileSize=${inputBytes} persist=${persist} outcome=200 durationMs=${durationMs}`,
      );

      return {
        buffer: output,
        contentType: CONVERT_CONTENT_TYPE[targetFormat],
        downloadName: `converted.${targetFormat}`,
        jobId,
      };
    } catch (error) {
      const durationMs = Date.now() - started;
      const mapped = this.mapError(error);
      errorCode = error instanceof ConvertError ? error.code : 'CONVERT_FAILED';

      await this.prisma.conversionJob.create({
        data: {
          id: jobId,
          userId: input.userId,
          kind: 'file',
          sourceFormat,
          targetFormat,
          inputFilename: input.filename ?? null,
          inputBytes,
          status: 'ERROR',
          errorCode,
          persistRequested: persist,
          durationMs,
        },
      });

      this.logger.log(
        `userId=${input.userId} event=convert sourceFormat=${sourceFormat} targetFormat=${targetFormat} fileSize=${inputBytes} persist=${persist} outcome=${mapped.getStatus()} durationMs=${durationMs}`,
      );

      throw mapped;
    }
  }

  private logSave(
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
        outcome,
        fileSize,
        durationMs: Date.now() - started,
      }),
    );
  }

  private parseTarget(raw: string): ConvertFormat {
    if ((CONVERT_FORMATS as readonly string[]).includes(raw)) {
      return raw as ConvertFormat;
    }
    throw new ConvertError('UNSUPPORTED_FORMAT', 'Invalid targetFormat');
  }

  private runInWorker(
    inputPath: string,
    sourceFormat: ConvertFormat,
    targetFormat: ConvertFormat,
    timeoutMs: number,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(join(__dirname, 'convert.worker.js'), {
        workerData: { inputPath, sourceFormat, targetFormat },
      });

      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new ConvertError('TIMEOUT', 'Conversion timed out'));
      }, timeoutMs);

      const finish = (fn: () => void) => {
        clearTimeout(timer);
        fn();
      };

      worker.once('message', (message: ConvertWorkerResult) => {
        finish(() => {
          if (message.ok) {
            resolve(Buffer.from(message.output));
          } else {
            reject(new ConvertError(message.code, message.message));
          }
        });
      });

      worker.once('error', (err) => {
        finish(() => reject(err));
      });

      worker.once('exit', (code) => {
        if (code !== 0) {
          finish(() =>
            reject(new ConvertError('PARSE_ERROR', 'Conversion worker exited')),
          );
        }
      });
    });
  }

  private mapError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    if (error instanceof StorageError) {
      if (error.code === 'IO') {
        return new HttpException(
          error.message,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return new BadRequestException(error.message);
    }
    if (error instanceof ConvertError) {
      switch (error.code) {
        case 'PAYLOAD_TOO_LARGE':
          return new PayloadTooLargeException(error.message);
        case 'UNSUPPORTED_FORMAT':
          return new UnsupportedMediaTypeException(error.message);
        case 'TIMEOUT':
          return new RequestTimeoutException(error.message);
        default:
          return new BadRequestException(error.message);
      }
    }
    return new HttpException(
      'Conversion failed',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
