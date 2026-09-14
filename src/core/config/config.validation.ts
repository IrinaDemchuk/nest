import Joi from 'joi';

import { Config } from './config.types';

export const configValidationSchema = Joi.object<Config>({
  PORT: Joi.number().port().required(),
  NODE_ENV: Joi.string().valid('development', 'production').required(),

  /**
   * Health check options
   */
  HEALTH_CHECK_ENABLED: Joi.boolean().optional().default(false),

  /**
   * Throttler options
   */
  THROTTLE_GLOBAL_TTL: Joi.number().optional().default(10000),
  THROTTLE_GLOBAL_LIMIT: Joi.number().optional().default(10),

  /**
   * PostgreSQL database options
   */
  POSTGRES_HOST: Joi.string().hostname().required(),
  POSTGRES_PORT: Joi.number().port().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_SYNCHRONIZE: Joi.boolean().optional().default(false),
  POSTGRES_LOGGING: Joi.boolean().optional().default(false),
  POSTGRES_MIGRATIONS_RUN: Joi.boolean().optional().default(false),

  DATABASE_URL: Joi.string().uri().required(),
  AUTH_REGISTRATION_EMAIL_CONFIRMATION_REQUIRED: Joi.boolean()
    .optional()
    .default(true),
  AUTH_REGISTRATION_OTP_TTL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(600),
  AUTH_REGISTRATION_OTP_LENGTH: Joi.number()
    .integer()
    .min(4)
    .max(8)
    .optional()
    .default(6),
  AUTH_REGISTRATION_OTP_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(5),
  AUTH_REGISTRATION_OTP_RESEND_SECONDS: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(60),
  SMTP_HOST: Joi.string().hostname().required(),
  SMTP_PORT: Joi.number().port().required(),
  SMTP_SECURE: Joi.boolean().optional().default(false),
  SMTP_USER: Joi.string().allow('').required(),
  SMTP_PASSWORD: Joi.string().allow('').required(),
  SMTP_FROM: Joi.string().allow('').required(),
  JWT_SECRET: Joi.string().allow('').required(),
  JWT_EXPIRES_IN: Joi.string().allow('').required(),
  JWT_REFRESH_SECRET: Joi.string().allow('').required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().allow('').required(),
  COOKIE_SECRET: Joi.string().required(),
  COOKIE_SAMESITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .optional()
    .default('lax'),
  COOKIE_SECURE: Joi.boolean().optional(),
  COOKIE_DOMAIN: Joi.string().allow('').optional(),
});
