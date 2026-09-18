import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpStatus } from '@nestjs/common';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_PATH,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_PATH,
} from '../auth/auth-cookies.service';
import { RbacGuard } from '../rbac/guards/rbac.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { InitiateEmailChangeDto } from './dto/initiate-email-change.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { InitiateAccountDeletionDto } from './dto/initiate-account-deletion.dto';
import { ConfirmAccountDeletionDto } from './dto/confirm-account-deletion.dto';

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

  @Patch(':id')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.updateProfile(
      {
        userId: request.user.userId,
        roles: request.user.roles,
      },
      id,
      dto,
    );
  }

  @Post(':id/email-change')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  initiateEmailChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateEmailChangeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.initiateEmailChange(
      {
        userId: request.user.userId,
        roles: request.user.roles,
      },
      id,
      dto,
    );
  }

  @Post(':id/email-change/confirm')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  confirmEmailChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmEmailChangeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.confirmEmailChange(
      {
        userId: request.user.userId,
        roles: request.user.roles,
      },
      id,
      dto,
    );
  }

  @Put(':id/photo')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const file = await request.file();
    return this.usersService.updatePhoto(
      {
        userId: request.user.userId,
        roles: request.user.roles,
      },
      id,
      file,
    );
  }

  @Delete(':id/photo')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  deletePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.deletePhoto(
      { userId: request.user.userId, roles: request.user.roles },
      id,
    );
  }

  @Post(':id/deletion')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  initiateAccountDeletion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateAccountDeletionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.initiateAccountDeletion(
      {
        userId: request.user.userId,
        roles: request.user.roles,
      },
      id,
      dto,
    );
  }

  @Post(':id/deletion/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async confirmAccountDeletion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmAccountDeletionDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.usersService.confirmAccountDeletion(
      {
        userId: request.user.userId,
        roles: request.user.roles,
      },
      id,
      dto,
    );
    reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: ACCESS_TOKEN_PATH });
    reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: REFRESH_TOKEN_PATH });
  }
}
