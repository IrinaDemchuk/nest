import 'reflect-metadata';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}

const DEFAULTS: Record<string, unknown> = {
  HEALTH_CHECK_ENABLED: false,
  THROTTLE_GLOBAL_TTL: 10000,
  THROTTLE_GLOBAL_LIMIT: 10,
  AUTH_REGISTRATION_EMAIL_CONFIRMATION_REQUIRED: true,
  AUTH_REGISTRATION_OTP_TTL_SECONDS: 600,
  AUTH_REGISTRATION_OTP_LENGTH: 6,
  AUTH_REGISTRATION_OTP_MAX_ATTEMPTS: 5,
  AUTH_REGISTRATION_OTP_RESEND_SECONDS: 60,
  SMTP_SECURE: false,
  COOKIE_SAMESITE: 'lax',
  AUTH_EMAIL_CHANGE_OTP_TTL_SECONDS: 600,
  AUTH_EMAIL_CHANGE_OTP_LENGTH: 6,
  AUTH_EMAIL_CHANGE_OTP_MAX_ATTEMPTS: 5,
  AUTH_EMAIL_CHANGE_OTP_RESEND_SECONDS: 60,
  AUTH_ACCOUNT_DELETION_OTP_TTL_SECONDS: 600,
  AUTH_ACCOUNT_DELETION_OTP_LENGTH: 6,
  AUTH_ACCOUNT_DELETION_OTP_MAX_ATTEMPTS: 5,
  AUTH_ACCOUNT_DELETION_OTP_RESEND_SECONDS: 60,
};

class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT!: number;

  @IsIn(['development', 'production'])
  NODE_ENV!: 'development' | 'production';

  @Transform(toBoolean)
  @IsBoolean()
  HEALTH_CHECK_ENABLED!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_GLOBAL_TTL!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_GLOBAL_LIMIT!: number;

  @IsString()
  @Matches(/^[A-Za-z0-9.-]+$/)
  POSTGRES_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  POSTGRES_PORT!: number;

  @IsString()
  POSTGRES_USER!: string;

  @IsString()
  POSTGRES_PASSWORD!: string;

  @IsString()
  POSTGRES_DB!: string;

  @IsString()
  @Matches(/^postgres(?:ql)?:\/\//)
  DATABASE_URL!: string;

  @Transform(toBoolean)
  @IsBoolean()
  AUTH_REGISTRATION_EMAIL_CONFIRMATION_REQUIRED!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_REGISTRATION_OTP_TTL_SECONDS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(8)
  AUTH_REGISTRATION_OTP_LENGTH!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_REGISTRATION_OTP_MAX_ATTEMPTS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_REGISTRATION_OTP_RESEND_SECONDS!: number;

  @IsString()
  @Matches(/^[A-Za-z0-9.-]+$/)
  SMTP_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  SMTP_PORT!: number;

  @Transform(toBoolean)
  @IsBoolean()
  SMTP_SECURE!: boolean;

  @IsString()
  SMTP_USER!: string;

  @IsString()
  SMTP_PASSWORD!: string;

  @IsString()
  SMTP_FROM!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRES_IN!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsString()
  COOKIE_SECRET!: string;

  @IsIn(['lax', 'strict', 'none'])
  COOKIE_SAMESITE!: 'lax' | 'strict' | 'none';

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE?: boolean;

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_EMAIL_CHANGE_OTP_TTL_SECONDS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(8)
  AUTH_EMAIL_CHANGE_OTP_LENGTH!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_EMAIL_CHANGE_OTP_MAX_ATTEMPTS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_EMAIL_CHANGE_OTP_RESEND_SECONDS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_ACCOUNT_DELETION_OTP_TTL_SECONDS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(8)
  AUTH_ACCOUNT_DELETION_OTP_LENGTH!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_ACCOUNT_DELETION_OTP_MAX_ATTEMPTS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_ACCOUNT_DELETION_OTP_RESEND_SECONDS!: number;
}

export function validateConfig(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const merged: Record<string, unknown> = { ...config };
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (merged[key] === undefined) {
      merged[key] = value;
    }
  }
  const validated = plainToInstance(EnvironmentVariables, merged, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
  if (errors.length > 0) {
    const details = errors
      .map((error) => {
        const constraints = Object.values(error.constraints ?? {});
        return `${error.property}: ${constraints.join(', ')}`;
      })
      .join('; ');
    throw new Error(`Configuration validation failed: ${details}`);
  }
  return validated;
}
