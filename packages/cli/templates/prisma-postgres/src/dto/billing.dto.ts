import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

import { ApiSamples } from './samples';

export class CheckAccessDto {
  @ApiProperty({ example: ApiSamples.featureId })
  @IsString()
  @MinLength(1)
  featureId!: string;

  @ApiPropertyOptional({ example: ApiSamples.requiredBalance })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  requiredBalance?: number;
}

export class AttachPlanDto {
  @ApiProperty({ example: ApiSamples.planSlug })
  @IsString()
  @MinLength(1)
  planId!: string;
}

export class TrackUsageDto {
  @ApiProperty({ example: ApiSamples.featureId })
  @IsString()
  @MinLength(1)
  featureId!: string;

  @ApiPropertyOptional({ example: ApiSamples.usageValue })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value?: number;
}
