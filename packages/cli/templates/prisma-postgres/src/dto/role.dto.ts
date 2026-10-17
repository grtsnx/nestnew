import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { ApiSamples } from './samples';

export class CreateRoleDto {
  @ApiProperty({ example: ApiSamples.roleName })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: ApiSamples.roleDescription })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ApiSamples.roleStatements,
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  statements!: Record<string, string[]>;

  @ApiPropertyOptional({
    example: ApiSamples.roleActive,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: ApiSamples.roleName })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: ApiSamples.roleDescription })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ApiSamples.roleActive })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({
    example: ApiSamples.roleStatements,
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  statements!: Record<string, string[]>;
}
