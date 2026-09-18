import { IsOptional, IsString, MaxLength } from 'class-validator';

export class InitiateAccountDeletionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
