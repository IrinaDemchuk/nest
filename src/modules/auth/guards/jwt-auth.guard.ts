import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';

import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth-cookies.service';
import { INACTIVE_USER_MESSAGE } from '../strategies/jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser>(
    err: Error | UnauthorizedException | null,
    user: TUser,
    info: Error | undefined,
    context: ExecutionContext,
  ): TUser {
    if (user) {
      return user;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const hasCookie = Boolean(request?.cookies?.[ACCESS_TOKEN_COOKIE]);

    const reason = this.resolveReason(err, info, hasCookie);
    this.logger.warn(`JWT auth failed: ${reason}`);

    throw err instanceof UnauthorizedException
      ? err
      : new UnauthorizedException('Unauthorized');
  }

  private resolveReason(
    err: Error | UnauthorizedException | null,
    info: Error | undefined,
    hasCookie: boolean,
  ): 'missing_cookie' | 'expired' | 'inactive_user' | 'invalid_signature' {
    if (
      err instanceof UnauthorizedException &&
      err.message === INACTIVE_USER_MESSAGE
    ) {
      return 'inactive_user';
    }

    if (!hasCookie || info?.message === 'No auth token') {
      return 'missing_cookie';
    }

    if (info?.name === 'TokenExpiredError') {
      return 'expired';
    }

    return 'invalid_signature';
  }
}
