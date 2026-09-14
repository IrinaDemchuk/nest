import { Module } from '@nestjs/common';

import { ConfigModule } from '@/core/config/config.module';
import { HealthModule } from '@/core/health/health.module';
import { ThrottlerModule } from '@/core/throttler/throttler.module';
import { AuthModule } from '@/modules/auth/auth.module';

/**
 *
 * Application modules
 *
 */
import { UsersModule } from '@/modules/users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { RbacModule } from '@/modules/rbac/rbac.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MailModule,
    HealthModule,
    ThrottlerModule,
    /**
     *
     * Application modules
     *
     */
    UsersModule,
    AuthModule,
    RbacModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
