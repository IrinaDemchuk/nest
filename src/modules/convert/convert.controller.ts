import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { removeSpill, spillStream } from '@/common/spill-stream';
import { ConvertService } from './convert.service';
import { CodecRegistry } from './codecs/codec-registry';
import { MultipartFields } from '@fastify/multipart';
import { parseSaveFlag } from '@/modules/storage/save-flag';

interface AuthenticatedRequest extends FastifyRequest {
  user: { userId: string; email: string; roles: string[] };
}

@Controller('api/convert')
export class ConvertController {
  constructor(
    private readonly convertService: ConvertService,
    private readonly codecs: CodecRegistry,
  ) {}

  @Get('formats')
  listFormats() {
    return this.codecs.listPairs();
  }

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async convert(
    @Req() request: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const spilled = await spillStream(file.file);
    try {
      const targetFormat = readField(file.fields, 'targetFormat');
      if (!targetFormat) {
        throw new BadRequestException('targetFormat is required');
      }
      const saveRaw = readField(file.fields, 'save');
      const persistRaw = readField(file.fields, 'persist');
      const persist =
        saveRaw !== undefined
          ? parseSaveFlag(saveRaw)
          : persistRaw === 'true' || persistRaw === '1';

      const result = await this.convertService.convert({
        userId: request.user.userId,
        path: spilled.path,
        byteLength: spilled.bytes,
        filename: file.filename,
        targetFormat,
        persist,
      });

      return reply
        .header('Content-Type', result.contentType)
        .header(
          'Content-Disposition',
          `attachment; filename="${result.downloadName}"`,
        )
        .send(result.buffer);
    } finally {
      await removeSpill(spilled.dir);
    }
  }
}

function readField(fields: MultipartFields, name: string): string | undefined {
  const raw = fields[name];
  if (!raw) {
    return undefined;
  }
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (item && item.type === 'field') {
    return String(item.value);
  }
  return undefined;
}
