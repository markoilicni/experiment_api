import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description:
      'Only SUPER may set active to true. Setting active to false uses POST /users/:id/deactivate. MANAGER and PDP cannot change active. Password changes use POST /users/me/password.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
