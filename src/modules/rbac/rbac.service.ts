import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  CreateGrantDto,
  CreatePermissionDto,
  CreateRoleDto,
  UpdateGrantDto,
  UpdatePermissionDto,
  UpdateRoleDto,
} from './dto/admin-rbac.dto';

type RoleGrantsMap = Map<string, Map<string, Set<string>>>;

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);
  private grantsCache: RoleGrantsMap = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.reloadConfig();
  }

  async reloadConfig(): Promise<void> {
    const grants = await this.prisma.grant.findMany({
      include: {
        role: true,
        permission: true,
      },
    });

    const newCache: RoleGrantsMap = new Map();

    for (const grant of grants) {
      const roleName = grant.role.name;
      const permName = grant.permission.name;

      if (!newCache.has(roleName)) {
        newCache.set(roleName, new Map());
      }

      const rolePermissionsMap = newCache.get(roleName)!;
      const actionsSet = new Set(grant.actions);

      rolePermissionsMap.set(permName, actionsSet);
    }

    this.grantsCache = newCache;
    this.logger.log('RBAC configuration cache reloaded successfully');
  }

  canAccess(userRoles: string[], permission: string, action?: string): boolean {
    if (!userRoles || userRoles.length === 0) return false;

    for (const role of userRoles) {
      const permissionsMap = this.grantsCache.get(role);
      if (!permissionsMap) continue;

      const allowedActions = permissionsMap.get(permission);
      if (!allowedActions) continue;

      if (allowedActions.size === 0) return true;

      if (action && allowedActions.has(action)) return true;
    }

    return false;
  }

  async getRoles() {
    return this.prisma.role.findMany();
  }

  async createRole(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Role already exists');

    const role = await this.prisma.role.create({ data: dto });
    await this.reloadConfig();
    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    try {
      const role = await this.prisma.role.update({
        where: { id },
        data: dto,
      });
      await this.reloadConfig();
      return role;
    } catch {
      throw new NotFoundException('Role not found');
    }
  }

  async deleteRole(id: string) {
    try {
      const role = await this.prisma.role.delete({ where: { id } });
      await this.reloadConfig();
      return role;
    } catch {
      throw new NotFoundException('Role not found');
    }
  }

  async getPermissions() {
    return this.prisma.permission.findMany();
  }

  async createPermission(dto: CreatePermissionDto) {
    const existing = await this.prisma.permission.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Permission already exists');

    const permission = await this.prisma.permission.create({ data: dto });
    await this.reloadConfig();
    return permission;
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    try {
      const permission = await this.prisma.permission.update({
        where: { id },
        data: dto,
      });
      await this.reloadConfig();
      return permission;
    } catch {
      throw new NotFoundException('Permission not found');
    }
  }

  async deletePermission(id: string) {
    try {
      const permission = await this.prisma.permission.delete({ where: { id } });
      await this.reloadConfig();
      return permission;
    } catch {
      throw new NotFoundException('Permission not found');
    }
  }

  async getGrants() {
    return this.prisma.grant.findMany({
      include: { role: true, permission: true },
    });
  }

  async createGrant(dto: CreateGrantDto) {
    const existing = await this.prisma.grant.findUnique({
      where: {
        roleId_permissionId: {
          roleId: dto.roleId,
          permissionId: dto.permissionId,
        },
      },
    });
    if (existing) throw new ConflictException('Grant already exists');

    const grant = await this.prisma.grant.create({
      data: {
        roleId: dto.roleId,
        permissionId: dto.permissionId,
        actions: dto.actions || [],
      },
    });
    await this.reloadConfig();
    return grant;
  }

  async updateGrant(id: string, dto: UpdateGrantDto) {
    try {
      const grant = await this.prisma.grant.update({
        where: { id },
        data: { actions: dto.actions },
      });
      await this.reloadConfig();
      return grant;
    } catch {
      throw new NotFoundException('Grant not found');
    }
  }

  async deleteGrant(id: string) {
    try {
      const grant = await this.prisma.grant.delete({ where: { id } });
      await this.reloadConfig();
      return grant;
    } catch {
      throw new NotFoundException('Grant not found');
    }
  }

  async assignRoleToUser(userId: string, roleId: string) {
    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (existing) throw new ConflictException('User already has this role');

    return this.prisma.userRole.create({
      data: { userId, roleId },
    });
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    try {
      return await this.prisma.userRole.delete({
        where: { userId_roleId: { userId, roleId } },
      });
    } catch {
      throw new NotFoundException('User role relation not found');
    }
  }

  async getUserRoles(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((ur) => ur.role.name);
  }
}
