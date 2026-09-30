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
import { PrismaService } from '@/core/prisma/prisma.service';
import { FileStorage, StorageError } from '@/modules/storage/file-storage';
import { formatSaveLog } from '@/modules/storage/save-flag';
import { ImageError } from './image-error';
import { ImageSettingsService } from './image-settings.service';
import type { ImageWorkerResult } from './image.worker';
import type { ImageRunRequest } from './image-run';
import {
  DEFAULT_JPEG_QUALITY,
  IMAGE_CONTENT_TYPE,
  IMAGE_FORMATS,
  IMAGE_PAIRS,
  sniffImage,
  type ImageFormat,
  type ImageRasterFormat,
} from './image.types';

export interface ImageConvertInput {
  userId: string;
  buffer: Buffer;
  filename?: string;
  targetFormat: string;
  quality?: number;
  width?: number;
  height?: number;
  background?: string;
  save: boolean;
}

export interface ImageConvertOutput {
  buffer: Buffer;
  contentType: string;
  downloadName: string;
  jobId: string;
}

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: ImageSettingsService,
    private readonly storage: FileStorage,
  ) {}

  async convert(input: ImageConvertInput): Promise<ImageConvertOutput> {
    const started = Date.now();
    const save = input.save;
    const inputBytes = input.buffer.byteLength;
    let sourceFormat = 'unknown';
    let targetFormat = input.targetFormat;
    let jobId: string | undefined;

    try {
      if (inputBytes === 0) {
        throw new ImageError('PARSE_ERROR', 'File is empty');
      }

      const detected = sniffImage(input.buffer, input.filename);
      if (!detected) {
        throw new ImageError('UNSUPPORTED_FORMAT', 'Unsupported source format');
      }
      sourceFormat = detected;

      const maxBytes = this.settings.getMaxBytes(detected);
      if (inputBytes > maxBytes) {
        throw new ImageError(
          'PAYLOAD_TOO_LARGE',
          'File exceeds size limit for source format',
        );
      }

      const parsedTarget = this.parseTarget(input.targetFormat);
      targetFormat = parsedTarget;
      const rasterTarget = this.assertDirection(detected, parsedTarget);
      const options = this.parseOptions(input);

      const output = await this.runInWorker(
        {
          input: input.buffer,
          sourceFormat: detected,
          targetFormat: rasterTarget,
          quality: options.quality,
          width: options.width,
          height: options.height,
          background: options.background,
          maxWidth: this.settings.getMaxWidth(),
          maxHeight: this.settings.getMaxHeight(),
        },
        this.settings.getTimeoutMs(),
      );

      jobId = randomUUID();
      let outputPath: string | null = null;
      if (save) {
        try {
          if (output.byteLength > this.settings.getMaxBytes(rasterTarget)) {
            throw new ImageError(
              'PAYLOAD_TOO_LARGE',
              'Output exceeds size limit for target format',
            );
          }
          outputPath = await this.storage.save(
            input.userId,
            jobId,
            rasterTarget,
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
          kind: 'image',
          sourceFormat,
          targetFormat,
          inputFilename: input.filename ?? null,
          inputBytes,
          outputBytes: output.byteLength,
          status: 'SUCCESS',
          persistRequested: save,
          outputPath,
          durationMs,
        },
      });

      this.logger.log(
        `userId=${input.userId} event=image-convert sourceFormat=${sourceFormat} targetFormat=${targetFormat} fileSize=${inputBytes} persist=${save} outcome=200 durationMs=${durationMs}`,
      );

      return {
        buffer: output,
        contentType: IMAGE_CONTENT_TYPE[rasterTarget],
        downloadName: `converted.${rasterTarget}`,
        jobId,
      };
    } catch (error) {
      const durationMs = Date.now() - started;
      const mapped = this.mapError(error);
      const errorCode =
        error instanceof ImageError ? error.code : 'CONVERT_FAILED';

      await this.prisma.conversionJob.create({
        data: {
          id: jobId,
          userId: input.userId,
          kind: 'image',
          sourceFormat,
          targetFormat,
          inputFilename: input.filename ?? null,
          inputBytes,
          status: 'ERROR',
          errorCode,
          persistRequested: save,
          outputPath: null,
          durationMs,
        },
      });

      this.logger.log(
        `userId=${input.userId} event=image-convert sourceFormat=${sourceFormat} targetFormat=${targetFormat} fileSize=${inputBytes} persist=${save} outcome=${mapped.getStatus()} durationMs=${durationMs}`,
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

  private parseTarget(raw: string): ImageFormat {
    if ((IMAGE_FORMATS as readonly string[]).includes(raw)) {
      return raw as ImageFormat;
    }
    throw new ImageError('INVALID_TARGET', 'Invalid targetFormat');
  }

  private assertDirection(
    source: ImageFormat,
    target: ImageFormat,
  ): ImageRasterFormat {
    if (!(IMAGE_PAIRS[source] as readonly string[]).includes(target)) {
      throw new ImageError(
        'UNSUPPORTED_DIRECTION',
        'Unsupported conversion direction',
      );
    }
    return target as ImageRasterFormat;
  }

  private parseOptions(input: ImageConvertInput): {
    quality: number;
    width: number | null;
    height: number | null;
    background: string;
  } {
    if (input.quality !== undefined) {
      if (
        !Number.isInteger(input.quality) ||
        input.quality < 1 ||
        input.quality > 100
      ) {
        throw new ImageError(
          'INVALID_OPTIONS',
          'quality must be an integer from 1 to 100',
        );
      }
    }
    if (
      input.width !== undefined &&
      (!Number.isInteger(input.width) || input.width < 1)
    ) {
      throw new ImageError(
        'INVALID_OPTIONS',
        'width must be a positive integer',
      );
    }
    if (
      input.height !== undefined &&
      (!Number.isInteger(input.height) || input.height < 1)
    ) {
      throw new ImageError(
        'INVALID_OPTIONS',
        'height must be a positive integer',
      );
    }
    const background = input.background ?? '#ffffff';
    if (!/^#[0-9a-fA-F]{6}$/.test(background)) {
      throw new ImageError(
        'INVALID_OPTIONS',
        'background must be a #RRGGBB color',
      );
    }
    return {
      quality: input.quality ?? DEFAULT_JPEG_QUALITY,
      width: input.width ?? null,
      height: input.height ?? null,
      background,
    };
  }

  private runInWorker(
    request: ImageRunRequest,
    timeoutMs: number,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(join(__dirname, 'image.worker.js'), {
        workerData: request,
      });
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        void worker.terminate();
        finish(() => reject(new ImageError('TIMEOUT', 'Conversion timed out')));
      }, timeoutMs);

      worker.once('message', (message: ImageWorkerResult) => {
        finish(() => {
          if (message.ok) {
            resolve(Buffer.from(message.output));
          } else {
            reject(new ImageError(message.code, message.message));
          }
        });
      });

      worker.once('error', (err) => {
        finish(() => reject(err));
      });

      worker.once('exit', (code) => {
        if (code !== 0) {
          finish(() =>
            reject(new ImageError('PARSE_ERROR', 'Conversion worker exited')),
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
    if (error instanceof ImageError) {
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
