import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import {
  CreateOrganisationDto,
  SetActiveOrganisationDto,
  UpdateOrganisationDto,
} from 'src/dto';

import { OrganisationService } from './organisation.service';

@ApiTags('Organisation')
@ApiBearerAuth('bearer')
@Controller({ path: 'organisation', version: '1' })
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Post()
  @ApiOperation({ summary: 'Create an organisation' })
  create(
    @Req() req: Request,
    @Body() body: CreateOrganisationDto,
  ): Promise<never> {
    return this.organisationService.create(req, body);
  }

  @Get()
  @ApiOperation({ summary: 'List your organisations' })
  list(@Req() req: Request): Promise<never> {
    return this.organisationService.list(req);
  }

  @Post('active')
  @ApiOperation({ summary: 'Switch active organisation' })
  setActive(
    @Req() req: Request,
    @Body() body: SetActiveOrganisationDto,
  ): Promise<never> {
    return this.organisationService.setActive(req, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organisation' })
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateOrganisationDto,
  ): Promise<never> {
    return this.organisationService.update(req, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an organisation' })
  delete(@Req() req: Request, @Param('id') id: string): Promise<never> {
    return this.organisationService.delete(req, id);
  }
}
