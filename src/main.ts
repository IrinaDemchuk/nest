import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import compression from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import { ValidationPipe } from '@nestjs/common';
import fastifyStatic from '@fastify/static';
import { join } from 'node:path';

import { AppModule } from './core/app/app.module';
import { ConfigService } from '@/core/config/config.service';
import fastifyMultipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(compression);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: [
      'http://localhost:5174',
      'http://localhost:4200',
      'http://localhost:8080',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const configService = app.get(ConfigService);

  await app.register(fastifyCookie, {
    secret: configService.get('COOKIE_SECRET'),
  });

  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  await app.register(fastifyMultipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  const port = configService.get('PORT');

  await app.listen(port);
}

bootstrap();
