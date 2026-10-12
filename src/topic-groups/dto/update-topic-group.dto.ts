import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTopicGroupDto {
  @ApiPropertyOptional({ example: 'Geometry' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    example: 'clxyzdiscipline',
    description: 'Move this topic group to another discipline',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  disciplineId?: string;
}
