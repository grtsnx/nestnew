import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import {
  AddTeamMemberDto,
  CreateTeamDto,
  RemoveTeamMemberDto,
  TeamOrganizationQueryDto,
  UpdateTeamDto,
} from 'src/dto';

import { TeamService } from './team.service';

@ApiTags('Teams')
@ApiBearerAuth('bearer')
@Controller({ path: 'organisation/team', version: '1' })
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @ApiOperation({ summary: 'Create a team' })
  create(@Req() req: Request, @Body() body: CreateTeamDto): Promise<never> {
    return this.teamService.create(req, body);
  }

  @Get()
  @ApiOperation({ summary: 'List teams' })
  list(@Req() req: Request): Promise<never> {
    return this.teamService.list(req);
  }

  @Post(':teamId/members')
  @ApiOperation({ summary: 'Add someone to team' })
  addMember(
    @Req() req: Request,
    @Param('teamId') teamId: string,
    @Body() body: AddTeamMemberDto,
  ): Promise<never> {
    return this.teamService.addMember(req, teamId, body);
  }

  @Delete('members')
  @ApiOperation({ summary: 'Remove someone from team' })
  removeMember(
    @Req() req: Request,
    @Body() body: RemoveTeamMemberDto,
  ): Promise<never> {
    return this.teamService.removeMember(req, body);
  }

  @Patch(':teamId')
  @ApiOperation({ summary: 'Update a team' })
  update(
    @Req() req: Request,
    @Param('teamId') teamId: string,
    @Body() body: UpdateTeamDto,
  ): Promise<never> {
    return this.teamService.update(req, teamId, body);
  }

  @Delete(':teamId')
  @ApiOperation({ summary: 'Delete a team' })
  delete(
    @Req() req: Request,
    @Param('teamId') teamId: string,
    @Query() query: TeamOrganizationQueryDto,
  ): Promise<never> {
    return this.teamService.delete(req, teamId, query.organizationId);
  }
}
