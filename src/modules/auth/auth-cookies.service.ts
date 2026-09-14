import { Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { CookieSerializeOptions } from '@fastify/cookie';

import { ConfigService } from '@/core/config/config.service';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const ACCESS_TOKEN_PATH = '/';
export const REFRESH_TOKEN_PATH = '/auth';

@Injectable()
export class AuthCookiesService {
  constructor(private readonly config: ConfigService) {}

  setAuthCookies(
    reply: FastifyReply,
    accessToken: string,
    refreshToken: string,
  ): void {
    reply.setCookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      this.accessCookieOptions(),
    );
    reply.setCookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      this.refreshCookieOptions(),
    );
  }

  clearAuthCookies(reply: FastifyReply): void {
    reply.clearCookie(ACCESS_TOKEN_COOKIE, this.accessCookieOptions());
    reply.clearCookie(REFRESH_TOKEN_COOKIE, this.refreshCookieOptions());
  }

  getAccessCookieOptions() {
    return this.accessCookieOptions();
  }

  getRefreshCookieOptions() {
    return this.refreshCookieOptions();
  }

  private accessCookieOptions(): CookieSerializeOptions {
    return this.baseCookieOptions(
      ACCESS_TOKEN_PATH,
      this.durationToSeconds(this.config.get('JWT_EXPIRES_IN') || '15m'),
    );
  }

  private refreshCookieOptions(): CookieSerializeOptions {
    return this.baseCookieOptions(
      REFRESH_TOKEN_PATH,
      this.durationToSeconds(
        this.config.get('JWT_REFRESH_EXPIRES_IN') || '30d',
      ),
    );
  }

  private baseCookieOptions(
    path: string,
    maxAgeSeconds: number,
  ): CookieSerializeOptions {
    const domain = this.config.get('COOKIE_DOMAIN');
    const sameSite = this.resolveSameSite();

    return {
      path,
      httpOnly: true,
      secure: this.resolveSecure(),
      sameSite,
      maxAge: maxAgeSeconds,
      ...(domain ? { domain } : {}),
    };
  }

  private resolveSecure(): boolean {
    const raw = this.config.get('COOKIE_SECURE');
    if (String(raw) === 'true') return true;
    if (String(raw) === 'false') return false;
    return this.config.get('NODE_ENV') === 'production';
  }

  private resolveSameSite(): 'lax' | 'strict' | 'none' {
    const value = this.config.get('COOKIE_SAMESITE') || 'lax';
    if (value === 'strict' || value === 'none' || value === 'lax') {
      return value;
    }
    return 'lax';
  }

  private durationToSeconds(value: string): number {
    const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
    if (!match) {
      throw new Error(`Invalid JWT duration: ${value}`);
    }
    const amount = Number(match[1]);
    const unit = match[2];
    const ms =
      unit === 'ms'
        ? amount
        : unit === 's'
          ? amount * 1000
          : unit === 'm'
            ? amount * 60_000
            : unit === 'h'
              ? amount * 3_600_000
              : amount * 86_400_000;
    return Math.floor(ms / 1000);
  }
}
