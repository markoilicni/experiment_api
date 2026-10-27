import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export const USER_SORT_FIELDS = [
  'username',
  'name',
  'email',
  'role',
  'createdAt',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export const DEFAULT_USERS_PAGE = 1;
export const DEFAULT_USERS_PAGE_SIZE = 100;

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

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Manager user id' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  managerId?: string;

  @ApiPropertyOptional({
    description: '1-based page number',
    default: DEFAULT_USERS_PAGE,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of users per page',
    default: DEFAULT_USERS_PAGE_SIZE,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
