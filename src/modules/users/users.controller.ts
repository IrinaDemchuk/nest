import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

import { RbacGuard } from '../rbac/guards/rbac.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { UsersService } from './users.service';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    email: string;
    roles: string[];
  };
}

@Controller('users')
@UseGuards(RbacGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  getProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.getProfile(
      {
        userId: request.user.userId,
        roles: request.user.roles,
      },
      id,
    );
  }

  @Delete(':id')
  @RequirePermission('users', 'delete')
  deleteUser(@Param('id') id: string) {
    return { message: `User ${id} deleted` };
  }
}
