import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import {
  TRANSFORMATION_RETENTION_MAX_DAYS,
  TRANSFORMATION_RETENTION_MIN_DAYS,
} from '../transformation-settings.constants';

export class UpdateTransformationSettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(TRANSFORMATION_RETENTION_MIN_DAYS)
  @Max(TRANSFORMATION_RETENTION_MAX_DAYS)
  retentionDays!: number;
}
