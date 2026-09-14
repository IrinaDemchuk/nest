import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ConfirmLoginOtpDto {
  @IsString()
  @IsNotEmpty()
  attemptId!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
