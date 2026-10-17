import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { ApiSamples } from './samples';

export class InviteMemberDto {
  @ApiProperty({ example: ApiSamples.memberEmail })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: ApiSamples.memberRole,
    description: 'owner | admin | member',
  })
  @IsString()
  @MinLength(1)
  role!: string;

  @ApiPropertyOptional({ example: ApiSamples.orgId })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ example: ApiSamples.resendInvite })
  @IsOptional()
  @IsBoolean()
  resend?: boolean;

  @ApiPropertyOptional({ example: ApiSamples.teamId })
  @IsOptional()
  @IsString()
  teamId?: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ example: ApiSamples.memberRoleAdmin })
  @IsString()
  @MinLength(1)
  role!: string;

  @ApiPropertyOptional({ example: ApiSamples.orgId })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
