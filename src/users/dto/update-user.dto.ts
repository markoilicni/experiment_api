import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({ example: 'new-secret' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Only SUPER may set active to true. Setting active to false uses POST /users/:id/deactivate. MANAGER and PDP cannot change active.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
