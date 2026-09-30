import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  HISTORY_FORMATS,
  HISTORY_MAX_LIMIT,
  HISTORY_MIN_LIMIT,
  HISTORY_STATUSES,
  HISTORY_TYPES,
  type HistoryFormat,
  type HistoryStatus,
  type HistoryType,
} from '../history.constants';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === '' || value === null) {
    return undefined;
  }
  return value;
}

export class HistoryQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(HISTORY_MIN_LIMIT)
  @Max(HISTORY_MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(HISTORY_TYPES)
  type?: HistoryType;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(HISTORY_FORMATS)
  sourceFormat?: HistoryFormat;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(HISTORY_FORMATS)
  targetFormat?: HistoryFormat;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(HISTORY_STATUSES)
  status?: HistoryStatus;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsISO8601()
  createdAtFrom?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsISO8601()
  createdAtTo?: string;
}
