import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

import { ApiSamples } from './samples';

export class CreatePlanDto {
  @ApiProperty({ example: ApiSamples.planName })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: ApiSamples.planSlug })
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiPropertyOptional({ example: ApiSamples.planDescription })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ApiSamples.planAudience,
    enum: ['individual', 'organization'],
  })
  @IsString()
  audience!: string;

  @ApiProperty({
    example: ApiSamples.planBillingType,
    enum: ['free', 'recurring', 'credits'],
  })
  @IsString()
  billingType!: string;

  @ApiPropertyOptional({ example: ApiSamples.autumnProductId })
  @IsOptional()
  @IsString()
  autumnProductId?: string;

  @ApiPropertyOptional({
    example: ApiSamples.planLimits,
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  limits?: Record<string, number>;

  @ApiPropertyOptional({ example: ApiSamples.trialDays })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({
    example: ApiSamples.planActive,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    example: ApiSamples.planSortOrder,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: ApiSamples.planName })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: ApiSamples.planDescription })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ApiSamples.planAudienceOrg })
  @IsOptional()
  @IsString()
  audience?: string;

  @ApiPropertyOptional({ example: ApiSamples.planBillingType })
  @IsOptional()
  @IsString()
  billingType?: string;

  @ApiPropertyOptional({ example: ApiSamples.autumnProductId })
  @IsOptional()
  @IsString()
  autumnProductId?: string;

  @ApiPropertyOptional({
    example: ApiSamples.planLimitsUpdated,
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  limits?: Record<string, number>;

  @ApiPropertyOptional({ example: ApiSamples.trialDaysShort })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ example: ApiSamples.planActive })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: ApiSamples.planSortOrderUpdated })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
