import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateTopicGroupDto {
  @ApiProperty({ example: 'Algebra' })
  @IsString()
  @MinLength(1)
  name: string;
}
