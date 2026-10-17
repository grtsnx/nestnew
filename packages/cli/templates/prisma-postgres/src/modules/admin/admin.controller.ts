import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, Session } from '@thallesp/nestjs-better-auth';
import type { Request, Response } from 'express';

import type { Session as AuthSession } from 'src/lib';
import {
  AdminAddMemberDto,
  AdminCreateTeamDto,
  AdminInviteMemberDto,
  AdminSetPasswordDto,
  AdminUpdateUserDto,
  BanUserDto,
  CreateOrganisationDto,
  CreatePlanDto,
  CreateRoleDto,
  InviteStaffDto,
  ListAuditLogsQueryDto,
  ListOrganisationsQueryDto,
  ListTeamsQueryDto,
  ListUsersQueryDto,
  MultiSessionSettingDto,
  RewardCreditsDto,
  SignupCreditsSettingDto,
  UpdateMemberRoleDto,
  UpdateOrganisationDto,
  UpdatePlanDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
  UpdateTeamDto,
  AddTeamMemberDto,
} from 'src/dto';

import { AdminService } from './admin.service';

@ApiTags('BackOffice')
@ApiBearerAuth('bearer')
@Roles(['admin'])
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  listUsers(
    @Req() req: Request,
    @Query() query: ListUsersQueryDto,
  ): Promise<never> {
    return this.adminService.listUsers(req, query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get one user' })
  getUser(@Req() req: Request, @Param('id') id: string): Promise<never> {
    return this.adminService.getUser(req, id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update a user' })
  updateUser(
    @Req() req: Request,
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Body() body: AdminUpdateUserDto,
  ): Promise<never> {
    return this.adminService.updateUser(req, session, id, body);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user' })
  deleteUser(
    @Req() req: Request,
    @Session() session: AuthSession,
    @Param('id') id: string,
  ): Promise<never> {
    return this.adminService.deleteUser(req, session, id);
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: 'Ban a user' })
  banUser(
    @Req() req: Request,
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Body() body: BanUserDto = {},
  ): Promise<never> {
    return this.adminService.banUser(req, session, id, body);
  }

  @Post('users/:id/unban')
  @ApiOperation({ summary: 'Unban a user' })
  unbanUser(
    @Req() req: Request,
    @Session() session: AuthSession,
    @Param('id') id: string,
  ): Promise<never> {
    return this.adminService.unbanUser(req, session, id);
  }

  @Get('users/:id/sessions')
  @ApiOperation({ summary: 'List a user sessions' })
  listUserSessions(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<never> {
    return this.adminService.listUserSessions(req, id);
  }

  @Delete('users/:id/sessions')
  @ApiOperation({ summary: 'Revoke a user sessions' })
  revokeUserSessions(
    @Req() req: Request,
    @Session() session: AuthSession,
    @Param('id') id: string,
  ): Promise<never> {
    return this.adminService.revokeUserSessions(req, session, id);
  }

  @Delete('users/:id/sessions/:sessionId')
  @ApiOperation({ summary: 'End one user session' })
  revokeUserSession(
    @Req() req: Request,
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ): Promise<never> {
    return this.adminService.revokeUserSession(req, session, id, sessionId);
  }

  @Patch('users/:id/password')
  @ApiOperation({ summary: 'Set a user password' })
  setUserPassword(
    @Req() req: Request,
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Body() body: AdminSetPasswordDto,
  ): Promise<never> {
    return this.adminService.setUserPassword(req, session, id, body);
  }

  @Post('users/:id/impersonate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Impersonate a user' })
  impersonateUser(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Session() session: AuthSession,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.adminService.impersonateUser(req, res, session, id);
  }

  @Roles([])
  @Post('impersonate/stop')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Stop impersonating a user',
    description:
      'Allowed while impersonating, even if the target is not admin.',
  })
  stopImpersonating(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Session() session: AuthSession,
  ): Promise<Record<string, unknown>> {
    return this.adminService.stopImpersonating(req, res, session);
  }

  @Post('organisations')
  @ApiOperation({ summary: 'Create an organisation' })
  createOrganisation(
    @Session() session: AuthSession,
    @Body() body: CreateOrganisationDto,
  ): Promise<never> {
    return this.adminService.createOrganisation(session, body);
  }

  @Get('organisations')
  @ApiOperation({ summary: 'List all organisations' })
  listOrganisations(@Query() query: ListOrganisationsQueryDto): Promise<never> {
    return this.adminService.listOrganisations(query);
  }

  @Get('organisations/:id')
  @ApiOperation({ summary: 'Get one organisation' })
  getOrganisation(@Param('id') id: string): Promise<never> {
    return this.adminService.getOrganisation(id);
  }

  @Patch('organisations/:id')
  @ApiOperation({ summary: 'Update an organisation' })
  updateOrganisation(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Body() body: UpdateOrganisationDto,
  ): Promise<never> {
    return this.adminService.updateOrganisation(session, id, body);
  }

  @Delete('organisations/:id')
  @ApiOperation({ summary: 'Delete an organisation' })
  deleteOrganisation(
    @Session() session: AuthSession,
    @Param('id') id: string,
  ): Promise<never> {
    return this.adminService.deleteOrganisation(session, id);
  }

  @Get('organisations/:id/members')
  @ApiOperation({ summary: 'List organisation members' })
  listOrganisationMembers(@Param('id') id: string): Promise<never> {
    return this.adminService.listOrganisationMembers(id);
  }

  @Post('organisations/:id/members')
  @ApiOperation({ summary: 'Add an organisation member' })
  addOrganisationMember(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Body() body: AdminAddMemberDto,
  ): Promise<never> {
    return this.adminService.addOrganisationMember(session, id, body);
  }

  @Patch('organisations/:id/members/:memberId')
  @ApiOperation({ summary: 'Change organisation member role' })
  updateOrganisationMemberRole(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberRoleDto,
  ): Promise<never> {
    return this.adminService.updateOrganisationMemberRole(
      session,
      id,
      memberId,
      body,
    );
  }

  @Delete('organisations/:id/members/:memberId')
  @ApiOperation({ summary: 'Remove an organisation member' })
  removeOrganisationMember(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ): Promise<never> {
    return this.adminService.removeOrganisationMember(session, id, memberId);
  }

  @Get('organisations/:id/invitations')
  @ApiOperation({ summary: 'List organisation invitations' })
  listOrganisationInvitations(@Param('id') id: string): Promise<never> {
    return this.adminService.listOrganisationInvitations(id);
  }

  @Post('organisations/:id/invitations')
  @ApiOperation({ summary: 'Invite an organisation member' })
  inviteOrganisationMember(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Body() body: AdminInviteMemberDto,
  ): Promise<never> {
    return this.adminService.inviteOrganisationMember(session, id, body);
  }

  @Delete('organisations/:id/invitations/:invitationId')
  @ApiOperation({ summary: 'Cancel an organisation invitation' })
  cancelOrganisationInvitation(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
  ): Promise<never> {
    return this.adminService.cancelOrganisationInvitation(
      session,
      id,
      invitationId,
    );
  }

  @Post('teams')
  @ApiOperation({ summary: 'Create a team' })
  createTeam(
    @Session() session: AuthSession,
    @Body() body: AdminCreateTeamDto,
  ): Promise<never> {
    return this.adminService.createTeam(session, body);
  }

  @Get('teams')
  @ApiOperation({ summary: 'List all teams' })
  listTeams(@Query() query: ListTeamsQueryDto): Promise<never> {
    return this.adminService.listTeams(query);
  }

  @Get('teams/:id')
  @ApiOperation({ summary: 'Get one team' })
  getTeam(@Param('id') id: string): Promise<never> {
    return this.adminService.getTeam(id);
  }

  @Patch('teams/:id')
  @ApiOperation({ summary: 'Update a team' })
  updateTeam(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Body() body: UpdateTeamDto,
  ): Promise<never> {
    return this.adminService.updateTeam(session, id, body);
  }

  @Delete('teams/:id')
  @ApiOperation({ summary: 'Delete a team' })
  deleteTeam(
    @Session() session: AuthSession,
    @Param('id') id: string,
  ): Promise<never> {
    return this.adminService.deleteTeam(session, id);
  }

  @Get('teams/:id/members')
  @ApiOperation({ summary: 'List team members' })
  listTeamMembers(@Param('id') id: string): Promise<never> {
    return this.adminService.listTeamMembers(id);
  }

  @Post('teams/:id/members')
  @ApiOperation({ summary: 'Add someone to team' })
  addTeamMember(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Body() body: AddTeamMemberDto,
  ): Promise<never> {
    return this.adminService.addTeamMember(session, id, body.userId);
  }

  @Delete('teams/:id/members/:userId')
  @ApiOperation({ summary: 'Remove someone from team' })
  removeTeamMember(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<never> {
    return this.adminService.removeTeamMember(session, id, userId);
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'List auth audit logs',
    description:
      'Requires Better Auth dash() and org owner/admin membership for scoped queries.',
  })
  listAuditLogs(
    @Req() req: Request,
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<never> {
    return this.adminService.listAuditLogs(req, query);
  }

  @Post('staff/invite')
  @ApiOperation({ summary: 'Invite staff with a role' })
  inviteStaff(
    @Req() req: Request,
    @Body() body: InviteStaffDto,
  ): Promise<never> {
    return this.adminService.inviteStaff(req, body);
  }

  @Get('roles')
  @ApiOperation({ summary: 'List roles' })
  listRoles(): Promise<never> {
    return this.adminService.listRoles();
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create a role' })
  createRole(@Body() body: CreateRoleDto): Promise<never> {
    return this.adminService.createRole(body);
  }

  @Patch('roles/:id')
  @ApiOperation({ summary: 'Update a role' })
  updateRole(
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
  ): Promise<never> {
    return this.adminService.updateRole(id, body);
  }

  @Put('roles/:id/permissions')
  @ApiOperation({ summary: 'Set role permissions' })
  updateRolePermissions(
    @Param('id') id: string,
    @Body() body: UpdateRolePermissionsDto,
  ): Promise<never> {
    return this.adminService.updateRolePermissions(id, body);
  }

  @Roles(['admin', 'finance_officer'])
  @Get('plans')
  @ApiOperation({ summary: 'List billing plans' })
  listPlans(): Promise<never> {
    return this.adminService.listPlans();
  }

  @Post('plans')
  @ApiOperation({ summary: 'Create a billing plan' })
  createPlan(@Body() body: CreatePlanDto): Promise<never> {
    return this.adminService.createPlan(body);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Update a billing plan' })
  updatePlan(
    @Param('id') id: string,
    @Body() body: UpdatePlanDto,
  ): Promise<never> {
    return this.adminService.updatePlan(id, body);
  }

  @Patch('settings/multi-session')
  @ApiOperation({ summary: 'Change multi-session setting' })
  updateMultiSession(@Body() body: MultiSessionSettingDto): Promise<never> {
    return this.adminService.updateMultiSession(body);
  }

  @Roles(['admin', 'finance_officer'])
  @Get('settings/credits')
  @ApiOperation({ summary: 'See default signup credits' })
  getSignupCredits(): Promise<never> {
    return this.adminService.getSignupCreditsSetting();
  }

  @Roles(['admin', 'finance_officer'])
  @Patch('settings/credits')
  @ApiOperation({ summary: 'Set default signup credits' })
  updateSignupCredits(
    @Session() session: AuthSession,
    @Body() body: SignupCreditsSettingDto,
  ): Promise<never> {
    return this.adminService.updateSignupCredits(session, body);
  }

  @Roles(['admin', 'finance_officer'])
  @Post('credits/reward')
  @ApiOperation({ summary: 'Reward user team or organisation credits' })
  rewardCredits(
    @Session() session: AuthSession,
    @Body() body: RewardCreditsDto,
  ): Promise<never> {
    return this.adminService.rewardCreditsToAudience(session, body);
  }
}
