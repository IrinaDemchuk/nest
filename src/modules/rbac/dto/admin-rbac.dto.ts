import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  actions!: string[];
}

export class UpdatePermissionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  actions?: string[];
}

export class CreateGrantDto {
  @IsString()
  @IsNotEmpty()
  roleId!: string;

  @IsString()
  @IsNotEmpty()
  permissionId!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  actions?: string[];
}

export class UpdateGrantDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  actions?: string[];
}
