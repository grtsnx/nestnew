import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ApiSamples } from './samples';

export class ListUsersQueryDto {
  @ApiPropertyOptional({
    example: ApiSamples.listLimit,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    example: ApiSamples.listOffset,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ example: ApiSamples.searchValue })
  @IsOptional()
  @IsString()
  searchValue?: string;

  @ApiPropertyOptional({ example: ApiSamples.searchField })
  @IsOptional()
  @IsString()
  searchField?: string;

  @ApiPropertyOptional({ example: ApiSamples.sortBy })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    example: ApiSamples.sortDirection,
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  sortDirection?: 'asc' | 'desc';
}

export class InviteStaffDto {
  @ApiProperty({ example: ApiSamples.staffEmail })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: ApiSamples.staffName })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({
    example: ApiSamples.staffRole,
    description: 'admin | support | developer | finance_officer',
  })
  @IsString()
  @MinLength(1)
  role!: string;
}

export class MultiSessionSettingDto {
  @ApiProperty({ example: ApiSamples.multiSessionEnabled })
  @IsBoolean()
  enabled!: boolean;
}

export class SignupCreditsSettingDto {
  @ApiProperty({
    example: ApiSamples.signupCreditsAmount,
    description: 'Free credits granted to each new user',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount!: number;
}

export class RewardCreditsDto {
  @ApiProperty({
    example: ApiSamples.creditAudience,
    enum: ['user', 'team', 'organization', 'organisation'],
    description: 'Who receives the credits',
  })
  @IsString()
  @IsIn(['user', 'team', 'organization', 'organisation'])
  audience!: string;

  @ApiProperty({ example: ApiSamples.userId })
  @IsString()
  @MinLength(1)
  targetId!: string;

  @ApiProperty({ example: ApiSamples.rewardCreditsAmount })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: ApiSamples.creditReason })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({
    example: ApiSamples.listLimit,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    example: ApiSamples.listOffset,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    example: ApiSamples.userId,
    description: 'Filter activity for one user (requires org admin access)',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: ApiSamples.organisationId,
    description: 'Filter activity for one organisation',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({
    example: ApiSamples.auditEventType,
    description: 'Filter by event type (e.g. user_signed_in)',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({
    example: ApiSamples.email,
    description: 'Match eventData.identifier (email, username, etc.)',
  })
  @IsOptional()
  @IsString()
  identifier?: string;
}

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: ApiSamples.name })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: ApiSamples.imageUrl })
  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  image?: string;

  @ApiPropertyOptional({
    example: ApiSamples.username,
    minLength: 3,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username?: string;

  @ApiPropertyOptional({ example: ApiSamples.telephone })
  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  @Matches(/^\+?[0-9\s\-()]+$/, {
    message: 'telephone must be a valid phone number',
  })
  telephone?: string;

  @ApiPropertyOptional({
    example: ApiSamples.staffRole,
    enum: ['admin', 'support', 'developer', 'finance_officer', 'user'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'support', 'developer', 'finance_officer', 'user'])
  role?: string;
}

export class BanUserDto {
  @ApiPropertyOptional({ example: 'Spamming' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  banReason?: string;

  @ApiPropertyOptional({
    example: 604800,
    description: 'Ban duration in seconds',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  banExpiresIn?: number;
}

export class ListOrganisationsQueryDto {
  @ApiPropertyOptional({
    example: ApiSamples.listLimit,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    example: ApiSamples.listOffset,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ListTeamsQueryDto {
  @ApiPropertyOptional({
    example: ApiSamples.listLimit,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    example: ApiSamples.listOffset,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ example: ApiSamples.orgId })
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class AdminCreateTeamDto {
  @ApiProperty({ example: ApiSamples.teamName })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: ApiSamples.orgId })
  @IsString()
  @MinLength(1)
  organizationId!: string;
}

export class AdminAddMemberDto {
  @ApiProperty({ example: ApiSamples.userId })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiProperty({
    example: ApiSamples.memberRole,
    enum: ['owner', 'admin', 'member'],
  })
  @IsString()
  @IsIn(['owner', 'admin', 'member'])
  role!: string;
}

export class AdminInviteMemberDto {
  @ApiProperty({ example: ApiSamples.memberEmail })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: ApiSamples.memberRole,
    enum: ['owner', 'admin', 'member'],
  })
  @IsString()
  @IsIn(['owner', 'admin', 'member'])
  role!: string;

  @ApiPropertyOptional({ example: ApiSamples.teamId })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({ example: ApiSamples.resendInvite })
  @IsOptional()
  @IsBoolean()
  resend?: boolean;
}

export class AdminSetPasswordDto {
  @ApiProperty({ example: ApiSamples.newPassword })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
