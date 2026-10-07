import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'superadmin' })
  @IsString()
  @MinLength(1)
  username: string;

  @ApiProperty({ example: 'super/1234' })
  @IsString()
  @MinLength(1)
  password: string;
}
