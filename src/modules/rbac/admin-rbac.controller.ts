import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import {
  CreateGrantDto,
  CreatePermissionDto,
  CreateRoleDto,
  UpdateGrantDto,
  UpdatePermissionDto,
  UpdateRoleDto,
} from './dto/admin-rbac.dto';
import { RequireRoles } from './decorators/require-roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@Controller('admin/rbac')
@UseGuards(RolesGuard)
@RequireRoles('admin')
export class AdminRbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  getRoles() {
    return this.rbacService.getRoles();
  }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Put('roles/:id')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteRole(id);
  }

  @Get('permissions')
  getPermissions() {
    return this.rbacService.getPermissions();
  }

  @Post('permissions')
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.rbacService.createPermission(dto);
  }

  @Put('permissions/:id')
  updatePermission(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.rbacService.updatePermission(id, dto);
  }

  @Delete('permissions/:id')
  deletePermission(@Param('id') id: string) {
    return this.rbacService.deletePermission(id);
  }

  @Get('grants')
  getGrants() {
    return this.rbacService.getGrants();
  }

  @Post('grants')
  createGrant(@Body() dto: CreateGrantDto) {
    return this.rbacService.createGrant(dto);
  }

  @Put('grants/:id')
  updateGrant(@Param('id') id: string, @Body() dto: UpdateGrantDto) {
    return this.rbacService.updateGrant(id, dto);
  }

  @Delete('grants/:id')
  deleteGrant(@Param('id') id: string) {
    return this.rbacService.deleteGrant(id);
  }

  @Post('users/:userId/roles')
  assignRole(@Param('userId') userId: string, @Body('roleId') roleId: string) {
    return this.rbacService.assignRoleToUser(userId, roleId);
  }

  @Delete('users/:userId/roles/:roleId')
  removeRole(@Param('userId') userId: string, @Param('roleId') roleId: string) {
    return this.rbacService.removeRoleFromUser(userId, roleId);
  }
}
