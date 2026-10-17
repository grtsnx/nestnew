import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

import { ApiSamples } from './samples';

export class CreateTeamDto {
  @ApiProperty({ example: ApiSamples.teamName })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: ApiSamples.orgId })
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateTeamDto {
  @ApiPropertyOptional({ example: ApiSamples.teamName })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

export class AddTeamMemberDto {
  @ApiProperty({ example: ApiSamples.userId })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiPropertyOptional({ example: ApiSamples.orgId })
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class RemoveTeamMemberDto {
  @ApiProperty({ example: ApiSamples.teamId })
  @IsString()
  @MinLength(1)
  teamId!: string;

  @ApiProperty({ example: ApiSamples.userId })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiPropertyOptional({ example: ApiSamples.orgId })
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class TeamOrganizationQueryDto {
  @ApiPropertyOptional({ example: ApiSamples.orgId })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
