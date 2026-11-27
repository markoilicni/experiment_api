import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTopicGroupDto {
  @ApiProperty({ example: 'Algebra' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPdp?: boolean;
}
