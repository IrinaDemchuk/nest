import { validateConfig } from './config.validation';

const validEnv = {
  PORT: '3007',
  NODE_ENV: 'development',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'postgres',
  POSTGRES_PASSWORD: 'postgres',
  POSTGRES_DB: 'app',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/app',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  SMTP_FROM: '',
  JWT_SECRET: 'secret',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'refresh',
  JWT_REFRESH_EXPIRES_IN: '7d',
  COOKIE_SECRET: 'cookie',
};

describe('validateConfig', () => {
  it('applies defaults and coerces env strings', () => {
    const config = validateConfig(validEnv);
    expect(config.PORT).toBe(3007);
    expect(config.HEALTH_CHECK_ENABLED).toBe(false);
    expect(config.AUTH_REGISTRATION_EMAIL_CONFIRMATION_REQUIRED).toBe(true);
    expect(config.COOKIE_SAMESITE).toBe('lax');
  });

  it('rejects a non-boolean flag', () => {
    expect(() =>
      validateConfig({ ...validEnv, SMTP_SECURE: 'sometimes' }),
    ).toThrow(/Configuration validation failed/);
  });
});
