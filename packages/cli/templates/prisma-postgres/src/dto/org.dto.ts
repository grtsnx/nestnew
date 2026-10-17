import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { ApiSamples } from './samples';

export class CreateOrganisationDto {
  @ApiProperty({ example: ApiSamples.orgName })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: ApiSamples.orgSlug })
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiPropertyOptional({ example: ApiSamples.orgLogo })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({
    example: ApiSamples.orgMetadata,
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: ApiSamples.keepCurrentActiveOrganization,
  })
  @IsOptional()
  @IsBoolean()
  keepCurrentActiveOrganization?: boolean;
}

export class SetActiveOrganisationDto {
  @ApiPropertyOptional({
    example: ApiSamples.orgId,
    nullable: true,
    description: 'Org id to activate; null clears active org',
  })
  @IsOptional()
  @IsString()
  organizationId?: string | null;

  @ApiPropertyOptional({ example: ApiSamples.orgSlug })
  @IsOptional()
  @IsString()
  organizationSlug?: string;
}

export class UpdateOrganisationDto {
  @ApiPropertyOptional({ example: ApiSamples.orgName })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: ApiSamples.orgSlug })
  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @ApiPropertyOptional({ example: ApiSamples.orgLogo })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({
    example: ApiSamples.orgMetadata,
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
