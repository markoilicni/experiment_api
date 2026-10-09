import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export const USER_SORT_FIELDS = [
  'username',
  'name',
  'email',
  'role',
  'createdAt',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class ListUsersQueryDto {
  @ApiPropertyOptional({ enum: USER_SORT_FIELDS })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
