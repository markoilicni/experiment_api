import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export const MIN_PASSWORD_LENGTH = 4;

export class SetPasswordDto {
  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  password: string;

  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  passwordConfirmation: string;
}
