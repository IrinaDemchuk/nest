import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const MAX_BYTES = 20 * 1024 * 1024;

export class UpdateConvertSettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES)
  csv!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES)
  json!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES)
  xml!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES)
  yaml!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120000)
  timeoutMs?: number;
}
