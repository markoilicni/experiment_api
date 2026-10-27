import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class DeactivateUserDto {
  @ApiPropertyOptional({
    description:
      'Required when deactivating a MANAGER who has direct reports. Those reports move to this active manager, who must be outside the closed tree.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  replacementManagerId?: string;

  @ApiPropertyOptional({
    description:
      'Required when deactivating a PDP who has assigned users. A PDP id moves every assigned user to that active PDP. null clears pdpId.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  replacementPdpId?: string | null;
}
