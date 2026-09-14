import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'rbac_permission';

export interface RequiredPermission {
  permission: string;
  action?: string;
}

export const RequirePermission = (permission: string, action?: string) =>
  SetMetadata(PERMISSION_KEY, { permission, action });
