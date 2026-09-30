import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HistoryQueryDto } from './dto/history-query.dto';
import { HistoryService } from './history.service';

interface AuthenticatedRequest extends FastifyRequest {
  user: { userId: string; email: string; roles: string[] };
}

@Controller('api/transformations')
export class TransformationsController {
  constructor(private readonly history: HistoryService) {}

  @Get('history')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  list(@Query() query: HistoryQueryDto, @Req() request: AuthenticatedRequest) {
    return this.history.listForSelf(request.user.userId, query);
  }

  @Get('history/:itemId/download')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async download(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() request: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ) {
    const file = await this.history.openForSelf(request.user.userId, itemId);
    return reply
      .header('Content-Type', file.contentType)
      .header(
        'Content-Disposition',
        `attachment; filename="${file.downloadName}"`,
      )
      .send(file.stream);
  }
}
