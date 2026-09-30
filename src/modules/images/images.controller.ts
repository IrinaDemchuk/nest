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
import { MultipartFields } from '@fastify/multipart';
import { ImagesService } from './images.service';
import { IMAGE_FORMATS, IMAGE_PAIRS } from './image.types';
import { parseSaveFlag } from '@/modules/storage/save-flag';

interface AuthenticatedRequest extends FastifyRequest {
  user: { userId: string; email: string; roles: string[] };
}

@Controller('api/images/convert')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get('formats')
  listFormats() {
    return IMAGE_FORMATS.map((source) => ({
      source,
      target: [...IMAGE_PAIRS[source]],
    }));
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
    const buffer = await file.toBuffer();
    const targetFormat = readField(file.fields, 'targetFormat');
    if (!targetFormat) {
      throw new BadRequestException('targetFormat is required');
    }

    const result = await this.imagesService.convert({
      userId: request.user.userId,
      buffer,
      filename: file.filename,
      targetFormat,
      quality: readOptionalInt(file.fields, 'quality'),
      width: readOptionalInt(file.fields, 'width'),
      height: readOptionalInt(file.fields, 'height'),
      background: readField(file.fields, 'background'),
      save: parseSaveFlag(readField(file.fields, 'save')),
    });

    return reply
      .header('Content-Type', result.contentType)
      .header(
        'Content-Disposition',
        `attachment; filename="${result.downloadName}"`,
      )
      .send(result.buffer);
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

function readOptionalInt(
  fields: MultipartFields,
  name: string,
): number | undefined {
  const raw = readField(fields, name);
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  return Number(raw);
}
