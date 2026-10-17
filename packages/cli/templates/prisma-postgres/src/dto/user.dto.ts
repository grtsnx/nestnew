import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ApiSamples } from './samples';

export class OnboardingDto {
  @ApiProperty({
    example: ApiSamples.username,
    minLength: 3,
    maxLength: 30,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username!: string;

  @ApiProperty({ example: ApiSamples.telephone })
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  @Matches(/^\+?[0-9\s\-()]+$/, {
    message: 'telephone must be a valid phone number',
  })
  telephone!: string;
}

export class UpdateProfileDto {
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
}

export class CheckUsernameQueryDto {
  @ApiProperty({ example: ApiSamples.username })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username!: string;
}

export class CheckTelephoneQueryDto {
  @ApiProperty({ example: ApiSamples.telephone })
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  telephone!: string;
}

export class TwoFactorDto {
  @ApiPropertyOptional({ example: ApiSamples.password })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: ApiSamples.issuer })
  @IsOptional()
  @IsString()
  issuer?: string;
}

export class VerifyTwoFactorDto {
  @ApiProperty({ example: ApiSamples.totp })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  code!: string;
}

export class LinkAccountDto {
  @ApiProperty({
    example: ApiSamples.oauthProvider,
    enum: ['google', 'github'],
  })
  @IsString()
  @IsIn(['google', 'github'])
  provider!: 'google' | 'github';

  @ApiPropertyOptional({ example: ApiSamples.callbackUrl })
  @IsOptional()
  @IsString()
  callbackURL?: string;
}

export class RevokeSessionsQueryDto {
  @ApiPropertyOptional({
    example: ApiSamples.revokeSessionsMode,
    enum: ['others', 'all'],
    description: 'others keeps this device; all ends every session',
  })
  @IsOptional()
  @IsIn(['others', 'all'])
  mode?: 'others' | 'all';
}

export class ChangePasswordDto {
  @ApiProperty({ example: ApiSamples.currentPassword })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ example: ApiSamples.newPassword })
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @ApiPropertyOptional({ example: ApiSamples.revokeOtherSessions })
  @IsOptional()
  revokeOtherSessions?: boolean;
}

export class DeleteAccountDto {
  @ApiPropertyOptional({
    example: ApiSamples.password,
    description: 'Required for email and password accounts',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
