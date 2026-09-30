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
import { RequireRoles } from '../rbac/decorators/require-roles.decorator';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { HistoryQueryDto } from './dto/history-query.dto';
import { HistoryService } from './history.service';

interface AuthenticatedRequest extends FastifyRequest {
  user: { userId: string; email: string; roles: string[] };
}

@Controller('admin/users')
@UseGuards(RolesGuard, ThrottlerGuard)
@RequireRoles('admin')
export class AdminTransformationsController {
  constructor(private readonly history: HistoryService) {}

  @Get(':userId/transformations/history')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  list(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: HistoryQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.history.listForUser(request.user.userId, userId, query);
  }

  @Get(':userId/transformations/history/:itemId/download')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async download(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() request: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ) {
    const file = await this.history.openForUser(
      request.user.userId,
      userId,
      itemId,
    );
    return reply
      .header('Content-Type', file.contentType)
      .header(
        'Content-Disposition',
        `attachment; filename="${file.downloadName}"`,
      )
      .send(file.stream);
  }
}
