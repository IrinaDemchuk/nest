import { Global, Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { AdminRbacController } from './admin-rbac.controller';
import { RbacGuard } from './guards/rbac.guard';

@Global()
@Module({
  controllers: [AdminRbacController],
  providers: [RbacService, RbacGuard],
  exports: [RbacService, RbacGuard],
})
export class RbacModule {}
