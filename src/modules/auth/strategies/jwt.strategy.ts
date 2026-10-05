import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { FastifyRequest } from 'fastify';

import { ConfigService } from '@/core/config/config.service';
import { UsersService } from '@/modules/users/users.service';
import { ACCESS_TOKEN_COOKIE } from '../auth-cookies.service';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  tv: number;
}

export const INACTIVE_USER_MESSAGE = 'inactive_user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: FastifyRequest) =>
          request?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET') || 'secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.usersService.findByIdWithRoles(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(INACTIVE_USER_MESSAGE);
    }

    if (payload.tv !== user.tokenVersion) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      userId: user.id,
      email: user.email,
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }
}
