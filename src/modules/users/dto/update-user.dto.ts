import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
} from 'class-validator';

function emptyToNull({ value }: { value: unknown }) {
  if (value === '') return null;
  return value;
}

@ValidatorConstraint({ name: 'atLeastOneUpdateField', async: false })
class AtLeastOneUpdateFieldConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const body = args.object as Record<string, unknown>;
    return Object.values(body).some((value) => value !== undefined);
  }

  defaultMessage() {
    return 'At least one field is required';
  }
}

function AtLeastOneUpdateField(): ClassDecorator {
  return (target) => {
    registerDecorator({
      name: 'atLeastOneUpdateField',
      target,
      propertyName: '__atLeastOne',
      validator: AtLeastOneUpdateFieldConstraint,
    });
  };
}

@AtLeastOneUpdateField()
export class UpdateUserDto {
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
  locale?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
