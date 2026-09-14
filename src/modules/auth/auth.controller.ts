import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AuthCookiesService,
  REFRESH_TOKEN_COOKIE,
} from './auth-cookies.service';
import { AuthService } from './auth.service';
import { ConfirmRegistrationDto } from './dto/confirm-registration.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfirmLoginOtpDto } from './dto/confirm-login.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '@/common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookies: AuthCookiesService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('register/confirm')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  confirmRegistration(@Body() dto: ConfirmRegistrationDto) {
    return this.authService.confirmRegistration(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(dto);
    if ('requiresConfirmation' in result) {
      return result;
    }
    this.authCookies.setAuthCookies(
      reply,
      result.accessToken,
      result.refreshToken,
    );
    return { authenticated: true };
  }

  @Public()
  @Post('login/confirm')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async confirmLogin(
    @Body() dto: ConfirmLoginOtpDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const tokens = await this.authService.confirmLogin(dto);
    this.authCookies.setAuthCookies(
      reply,
      tokens.accessToken,
      tokens.refreshToken,
    );
    return { authenticated: true };
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async refreshToken(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const tokens = await this.authService.refreshToken(
      request.cookies?.[REFRESH_TOKEN_COOKIE],
    );
    this.authCookies.setAuthCookies(
      reply,
      tokens.accessToken,
      tokens.refreshToken,
    );
    return { authenticated: true };
  }

  @Public()
  @Post('logout')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    this.authCookies.clearAuthCookies(reply);
    return { loggedOut: true };
  }
}
