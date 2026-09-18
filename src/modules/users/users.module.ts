import { Module } from '@nestjs/common';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ThrottlerModule } from '@/core/throttler/throttler.module';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [ThrottlerModule],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
