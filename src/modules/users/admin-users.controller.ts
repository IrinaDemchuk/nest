import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { RbacGuard } from '../rbac/guards/rbac.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { UsersService } from './users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { InitiateAccountDeletionDto } from './dto/initiate-account-deletion.dto';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    email: string;
    roles: string[];
  };
}

@Controller('admin/users')
@UseGuards(RbacGuard, ThrottlerGuard)
@RequirePermission('users', 'read')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  listUsers(
    @Query() query: ListUsersQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.listUsers(
      {
        userId: request.user.userId,
        roles: request.user.roles,
      },
      query,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateAccountDeletionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.deleteUserByAdmin(
      {
        userId: request.user.userId,
        roles: request.user.roles,
      },
      id,
      dto ?? {},
    );
  }
}
