import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({ example: 'new-secret' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;
}
