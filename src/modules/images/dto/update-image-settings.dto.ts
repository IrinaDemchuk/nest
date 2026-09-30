import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const MAX_BYTES = 20 * 1024 * 1024;

export class UpdateImageSettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES)
  png!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES)
  jpeg!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES)
  svg!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8192)
  maxWidth!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8192)
  maxHeight!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120000)
  timeoutMs?: number;
}
