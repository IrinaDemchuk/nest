import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { randomInt } from 'node:crypto';

import { ConfigService } from '@/core/config/config.service';
import { MailService } from '@/core/mail/mail.service';
import { PrismaService } from '@/core/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';
import { EmailOtpPurpose } from '@/generated/prisma/client';
import { ConfirmLoginOtpDto } from './dto/confirm-login.dto';
import { ConfirmRegistrationDto } from './dto/confirm-registration.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  tv: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = this.usersService.normalizeEmail(dto.email);
    const existing = await this.usersService.findByEmail(email);

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const confirmationRequired =
      String(
        this.config.get('AUTH_REGISTRATION_EMAIL_CONFIRMATION_REQUIRED'),
      ) === 'true';

    if (!confirmationRequired) {
      const user = await this.usersService.create(email, dto.password, true);

      this.logger.log(
        `Registration completed without confirmation for ${email}`,
      );

      return {
        requiresEmailConfirmation: false,
        userId: user.id,
      };
    }

    const user = await this.usersService.create(email, dto.password, false);
    const otp = await this.createRegistrationOtp(user.id);

    try {
      this.logger.log(`[TEST ONLY] Registration OTP for ${email}: ${otp}`);
      await this.mailService.sendRegistrationOtp(email, otp);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}`, error);
      throw new InternalServerErrorException(
        'Failed to send confirmation email. Please try again later.',
      );
    }

    this.logger.log(`Registration OTP sent for ${email}`);

    return {
      requiresEmailConfirmation: true,
      userId: user.id,
    };
  }

  async confirmRegistration(dto: ConfirmRegistrationDto) {
    const email = this.usersService.normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('Invalid confirmation code');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    const otp = await this.prisma.emailOtp.findFirst({
      where: {
        userId: user.id,
        purpose: EmailOtpPurpose.REGISTRATION,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('Invalid confirmation code');
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('Confirmation code has expired');
    }

    if (otp.attempts >= otp.maxAttempts) {
      throw new BadRequestException('Too many confirmation attempts');
    }

    const isValid = await verify(otp.codeHash, dto.code);

    if (!isValid) {
      await this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });

      throw new BadRequestException('Invalid confirmation code');
    }

    await this.prisma.$transaction([
      this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    this.logger.log(`Registration confirmed for ${email}`);

    return {
      verified: true,
      userId: user.id,
    };
  }

  async login(dto: LoginDto) {
    const email = this.usersService.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Email is not verified');
    }

    const isPasswordValid = await verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'REQUIRE_LOGIN_EMAIL_CONFIRMATION' },
    });

    const isConfirmationRequired = setting?.value === 'true';

    if (!isConfirmationRequired) {
      const userRoles = user.userRoles.map((r) => r.role.name);
      return this.generateTokens(
        user.id,
        user.email,
        userRoles,
        user.tokenVersion,
      );
    }

    const otp = this.generateOtp(6);
    const codeHash = await hash(otp);

    const attempt = await this.prisma.loginAttempt.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    this.logger.log(`[TEST ONLY] Login OTP for ${user.email}: ${otp}`);

    await this.mailService.sendMail({
      to: user.email,
      subject: 'Login Confirmation Code',
      text: `Your login confirmation code is: ${otp}`,
    });

    return {
      requiresConfirmation: true,
      attemptId: attempt.id,
    };
  }

  async confirmLogin(dto: ConfirmLoginOtpDto) {
    const attempt = await this.prisma.loginAttempt.findUnique({
      where: { id: dto.attemptId },
      include: {
        user: {
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        },
      },
    });

    if (!attempt || attempt.status !== 'PENDING') {
      throw new BadRequestException('Invalid or expired login attempt');
    }

    if (attempt.expiresAt < new Date()) {
      await this.prisma.loginAttempt.update({
        where: { id: attempt.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Login code has expired');
    }

    if (attempt.attempts >= attempt.maxAttempts) {
      throw new BadRequestException('Max confirmation attempts exceeded');
    }

    const isValid = attempt.codeHash
      ? await verify(attempt.codeHash, dto.code)
      : false;

    if (!isValid) {
      await this.prisma.loginAttempt.update({
        where: { id: attempt.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid confirmation code');
    }

    await this.prisma.loginAttempt.update({
      where: { id: attempt.id },
      data: { status: 'CONFIRMED' },
    });

    const userRoles = attempt.user.userRoles.map((r) => r.role.name);
    return this.generateTokens(
      attempt.user.id,
      attempt.user.email,
      userRoles,
      attempt.user.tokenVersion,
    );
  }

  async refreshToken(refreshToken: string | undefined) {
    if (!refreshToken) {
      this.logger.warn('Refresh failed: missing_cookie');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        { secret: String(this.config.get('JWT_REFRESH_SECRET')) },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { userRoles: { include: { role: true } } },
      });

      if (!user || !user.isActive) {
        this.logger.warn('Refresh failed: inactive_user');
        throw new UnauthorizedException('User no longer active');
      }

      if (payload.tv !== user.tokenVersion) {
        this.logger.warn('Refresh failed: revoked');
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const userRoles = user.userRoles.map((ur) => ur.role.name);
      return this.generateTokens(
        user.id,
        user.email,
        userRoles,
        user.tokenVersion,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn('Refresh failed: invalid_or_expired');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async revokeSession(
    accessToken: string | undefined,
    refreshToken: string | undefined,
  ): Promise<void> {
    const userId =
      (await this.userIdFromToken(accessToken, 'JWT_SECRET')) ??
      (await this.userIdFromToken(refreshToken, 'JWT_REFRESH_SECRET'));
    if (!userId) {
      return;
    }
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
    } catch {
      this.logger.warn(`Logout revoke skipped for userId=${userId}`);
    }
  }

  private async userIdFromToken(
    token: string | undefined,
    secretKey: 'JWT_SECRET' | 'JWT_REFRESH_SECRET',
  ): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: String(this.config.get(secretKey)),
      });
      return payload.sub || undefined;
    } catch {
      return undefined;
    }
  }

  private async generateTokens(
    userId: string,
    email: string,
    roles: string[],
    tokenVersion: number,
  ) {
    const payload: JwtPayload = {
      sub: userId,
      email,
      roles,
      tv: tokenVersion,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: String(this.config.get('JWT_SECRET')),
      expiresIn: String(
        this.config.get('JWT_EXPIRES_IN') || '15m',
      ) as JwtSignOptions['expiresIn'],
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: String(this.config.get('JWT_REFRESH_SECRET')),
      expiresIn: String(
        this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d',
      ) as JwtSignOptions['expiresIn'],
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async createRegistrationOtp(userId: string): Promise<string> {
    const length = Number(this.config.get('AUTH_REGISTRATION_OTP_LENGTH'));
    const ttlSeconds = Number(
      this.config.get('AUTH_REGISTRATION_OTP_TTL_SECONDS'),
    );
    const maxAttempts = Number(
      this.config.get('AUTH_REGISTRATION_OTP_MAX_ATTEMPTS'),
    );
    const resendSeconds = Number(
      this.config.get('AUTH_REGISTRATION_OTP_RESEND_SECONDS'),
    );

    const code = this.generateOtp(length);
    const codeHash = await hash(code);
    const now = new Date();

    await this.prisma.emailOtp.create({
      data: {
        userId,
        purpose: EmailOtpPurpose.REGISTRATION,
        codeHash,
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
        maxAttempts,
        resendAvailableAt: new Date(now.getTime() + resendSeconds * 1000),
      },
    });

    return code;
  }

  private generateOtp(length: number): string {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return String(randomInt(min, max + 1));
  }
}
