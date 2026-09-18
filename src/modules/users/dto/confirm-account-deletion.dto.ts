import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class ConfirmAccountDeletionDto {
  @IsUUID()
  challengeId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
