import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  USER_LIST_MAX_LIMIT,
  USER_LIST_MIN_LIMIT,
  USER_LIST_ORDERS,
  USER_LIST_SORTS,
  USER_LIST_STATUSES,
  type UserListOrder,
  type UserListSort,
  type UserListStatus,
} from '../helpers/user-list';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === '' || value === null) {
    return undefined;
  }
  return value;
}

export class ListUsersQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(USER_LIST_MIN_LIMIT)
  @Max(USER_LIST_MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(USER_LIST_STATUSES)
  status?: UserListStatus;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(USER_LIST_SORTS)
  sort?: UserListSort;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(USER_LIST_ORDERS)
  order?: UserListOrder;
}
