import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDisciplineDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'The study of numbers, quantities, and shapes' })
  @IsString()
  @MinLength(1)
  description: string;
}
