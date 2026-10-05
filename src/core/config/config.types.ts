export interface Config {
  PORT: number;
  NODE_ENV: 'development' | 'production';

  /**
   * Health check options
   */
  HEALTH_CHECK_ENABLED?: boolean;

  /**
   * Throttler options
   */
  THROTTLE_GLOBAL_TTL?: number;
  THROTTLE_GLOBAL_LIMIT?: number;

  /**
   * PostgreSQL database options
   */
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  /**
   * Prisma connection URL
   */
  DATABASE_URL: string;

  /**
   * Registration / OTP
   */
  AUTH_REGISTRATION_EMAIL_CONFIRMATION_REQUIRED: boolean;
  AUTH_REGISTRATION_OTP_TTL_SECONDS: number;
  AUTH_REGISTRATION_OTP_LENGTH: number;
  AUTH_REGISTRATION_OTP_MAX_ATTEMPTS: number;
  AUTH_REGISTRATION_OTP_RESEND_SECONDS: number;
  /**
   * SMTP / TurboSMTP
   */
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  SMTP_FROM: string;
  /**
   * Login / JWT
   */
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;

  /**
   * Cookie
   */
  COOKIE_SECRET: string;
  COOKIE_SAMESITE?: 'lax' | 'strict' | 'none';
  COOKIE_SECURE?: boolean;
  COOKIE_DOMAIN?: string;

  AUTH_EMAIL_CHANGE_OTP_TTL_SECONDS: number;
  AUTH_EMAIL_CHANGE_OTP_LENGTH: number;
  AUTH_EMAIL_CHANGE_OTP_MAX_ATTEMPTS: number;
  AUTH_EMAIL_CHANGE_OTP_RESEND_SECONDS: number;

  AUTH_ACCOUNT_DELETION_OTP_TTL_SECONDS: number;
  AUTH_ACCOUNT_DELETION_OTP_LENGTH: number;
  AUTH_ACCOUNT_DELETION_OTP_MAX_ATTEMPTS: number;
  AUTH_ACCOUNT_DELETION_OTP_RESEND_SECONDS: number;
}
