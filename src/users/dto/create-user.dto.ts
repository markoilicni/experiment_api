import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'jdoe' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(4)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 'jdoe@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ enum: Role, default: Role.USER })
  @IsEnum(Role)
  role: Role = Role.USER;

  @ApiPropertyOptional({ description: 'Manager user id' })
  @IsOptional()
  @IsString()
  managerId?: string;
}
