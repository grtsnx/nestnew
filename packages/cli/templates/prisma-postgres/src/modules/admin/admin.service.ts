import { createId } from '@paralleldrive/cuid2';
import { Injectable } from '@nestjs/common';
import { splitSetCookieHeader } from 'better-auth/cookies';
import { fromNodeHeaders } from 'better-auth/node';
import { useLogger } from 'evlog/nestjs';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Prisma } from 'src/lib/prisma/generated/client';

import {
  SIGNUP_CREDITS_KEY,
  PrismaService,
  auth,
  getSignupCredits,
  mapCreditRewardError,
  parseCreditAudience,
  rewardCredits,
  setSignupCredits,
  type Session,
} from 'src/lib';
import type {
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
} from 'src/dto';
import { handleResponse, rethrowAsHandleResponse } from 'src/middleware';
import { pickOrganisationUpdate } from 'src/modules/organisation/organisation.service';
import { pickTeamUpdate } from 'src/modules/team/team.service';

const MULTI_SESSION_KEY = 'multiSessionEnabled';
const PLATFORM_USER_ROLES = [
  'admin',
  'support',
  'developer',
  'finance_officer',
  'user',
] as const;
const ORG_MEMBER_ROLES = ['owner', 'admin', 'member'] as const;
const DEFAULT_LIST_LIMIT = 50;
const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

type PlatformUserRole = (typeof PLATFORM_USER_ROLES)[number];
type OrgMemberRole = (typeof ORG_MEMBER_ROLES)[number];

type AdminUserUpdate = {
  name?: string;
  image?: string;
  username?: string;
  telephone?: string;
  role?: string;
};

export function pickAdminUserUpdate(
  body: AdminUserUpdate,
): AdminUserUpdate | null {
  const data: AdminUserUpdate = {};
  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.image === 'string' && body.image.trim()) {
    data.image = body.image.trim();
  }
  if (typeof body.username === 'string' && body.username.trim()) {
    data.username = body.username.trim();
  }
  if (typeof body.telephone === 'string' && body.telephone.trim()) {
    data.telephone = body.telephone.trim();
  }
  if (typeof body.role === 'string' && body.role.trim()) {
    data.role = body.role.trim();
  }
  return Object.keys(data).length > 0 ? data : null;
}

export function parseAdminRole(
  value: string | undefined,
): PlatformUserRole | null {
  if (typeof value !== 'string') {
    return null;
  }
  const role = value.trim();
  return PLATFORM_USER_ROLES.includes(role as PlatformUserRole)
    ? (role as PlatformUserRole)
    : null;
}

export function parseOrgMemberRole(
  value: string | undefined,
): OrgMemberRole | null {
  if (typeof value !== 'string') {
    return null;
  }
  const role = value.trim();
  return ORG_MEMBER_ROLES.includes(role as OrgMemberRole)
    ? (role as OrgMemberRole)
    : null;
}

export function assertNotSelf(
  actorId: string,
  targetId: string,
  message: string,
): void {
  if (actorId === targetId) {
    throw new handleResponse(400, message);
  }
}

export function decodeOrganisationMetadata(value: string | null): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function impersonatedByOf(session: Session): string | null {
  const value = (session.session as { impersonatedBy?: string | null })
    .impersonatedBy;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function presentOrganisation<T extends { metadata: string | null }>(row: T) {
  return { ...row, metadata: decodeOrganisationMetadata(row.metadata) };
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export function applyAuthCookies(
  res: Response,
  headers: Headers | undefined,
): void {
  if (!headers) {
    return;
  }
  const listed =
    typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  const cookies =
    listed.length > 0
      ? listed
      : splitSetCookieHeader(headers.get('set-cookie') ?? '');
  for (const cookie of cookies) {
    if (cookie) {
      res.append('Set-Cookie', cookie);
    }
  }
}

async function readAuthApiResponse(result: globalThis.Response): Promise<{
  ok: boolean;
  status: number;
  payload: unknown;
}> {
  let payload: unknown;
  try {
    payload = await result.json();
  } catch {
    payload = undefined;
  }
  return { ok: result.ok, status: result.status, payload };
}

function rethrowAuthApiFailure(status: number, payload: unknown): never {
  const body =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const message =
    typeof body.message === 'string' && body.message.trim()
      ? body.message
      : 'Request failed';
  rethrowAsHandleResponse({
    statusCode: status,
    message,
    body,
  });
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(req: Request, query: ListUsersQueryDto): Promise<never> {
    try {
      const result = await auth.api.listUsers({
        query: {
          limit: query.limit,
          offset: query.offset,
          searchValue: query.searchValue,
          searchField: query.searchField as 'email' | 'name' | undefined,
          sortBy: query.sortBy,
          sortDirection: query.sortDirection,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Users loaded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async getUser(req: Request, userId: string): Promise<never> {
    try {
      const result = await auth.api.getUser({
        query: { id: userId },
        headers: fromNodeHeaders(req.headers),
      });
      if (!result) {
        throw new handleResponse(404, 'User not found');
      }
      throw new handleResponse(200, 'User loaded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async updateUser(
    req: Request,
    session: Session,
    userId: string,
    body: AdminUpdateUserDto,
  ): Promise<never> {
    const data = pickAdminUserUpdate(body);
    if (!data) {
      throw new handleResponse(400, 'No user changes');
    }

    const { role, ...profile } = data;
    const nextRole = role === undefined ? undefined : parseAdminRole(role);
    if (role !== undefined && !nextRole) {
      throw new handleResponse(400, 'Invalid user role');
    }

    const headers = fromNodeHeaders(req.headers);
    try {
      if (Object.keys(profile).length > 0) {
        await auth.api.adminUpdateUser({
          body: { userId, data: profile },
          headers,
        });
      }
      if (nextRole) {
        await auth.api.setRole({
          body: { userId, role: nextRole },
          headers,
        });
      }
      const result = await auth.api.getUser({
        query: { id: userId },
        headers,
      });
      this.auditAdmin({
        action: 'admin.user.update',
        actorId: session.user.id,
        target: { type: 'user', id: userId, fields: Object.keys(data) },
      });
      throw new handleResponse(200, 'User updated', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async deleteUser(
    req: Request,
    session: Session,
    userId: string,
  ): Promise<never> {
    assertNotSelf(session.user.id, userId, 'Cannot delete yourself');
    try {
      const result = await auth.api.removeUser({
        body: { userId },
        headers: fromNodeHeaders(req.headers),
      });
      await this.db().creditLedger.deleteMany({
        where: { audience: 'user', targetId: userId },
      });
      this.auditAdmin({
        action: 'admin.user.delete',
        actorId: session.user.id,
        target: { type: 'user', id: userId },
      });
      throw new handleResponse(200, 'User deleted', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async banUser(
    req: Request,
    session: Session,
    userId: string,
    body: BanUserDto,
  ): Promise<never> {
    assertNotSelf(session.user.id, userId, 'Cannot ban yourself');
    try {
      const result = await auth.api.banUser({
        body: {
          userId,
          banReason: body.banReason,
          banExpiresIn: body.banExpiresIn,
        },
        headers: fromNodeHeaders(req.headers),
      });
      this.auditAdmin({
        action: 'admin.user.ban',
        actorId: session.user.id,
        target: { type: 'user', id: userId },
      });
      throw new handleResponse(200, 'User banned', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async unbanUser(
    req: Request,
    session: Session,
    userId: string,
  ): Promise<never> {
    try {
      const result = await auth.api.unbanUser({
        body: { userId },
        headers: fromNodeHeaders(req.headers),
      });
      this.auditAdmin({
        action: 'admin.user.unban',
        actorId: session.user.id,
        target: { type: 'user', id: userId },
      });
      throw new handleResponse(200, 'User unbanned', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async listUserSessions(req: Request, userId: string): Promise<never> {
    try {
      const result = await auth.api.listUserSessions({
        body: { userId },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Sessions loaded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async revokeUserSessions(
    req: Request,
    session: Session,
    userId: string,
  ): Promise<never> {
    try {
      const result = await auth.api.revokeUserSessions({
        body: { userId },
        headers: fromNodeHeaders(req.headers),
      });
      this.auditAdmin({
        action: 'admin.user.sessions.revoke',
        actorId: session.user.id,
        target: { type: 'user', id: userId },
      });
      throw new handleResponse(200, 'Sessions revoked', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async setUserPassword(
    req: Request,
    session: Session,
    userId: string,
    body: AdminSetPasswordDto,
  ): Promise<never> {
    try {
      const result = await auth.api.setUserPassword({
        body: { userId, newPassword: body.newPassword },
        headers: fromNodeHeaders(req.headers),
      });
      this.auditAdmin({
        action: 'admin.user.password.update',
        actorId: session.user.id,
        target: { type: 'user', id: userId },
      });
      throw new handleResponse(200, 'Password updated', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async revokeUserSession(
    req: Request,
    session: Session,
    userId: string,
    sessionId: string,
  ): Promise<never> {
    const row = await this.db().session.findFirst({
      where: { id: sessionId, userId },
      select: { token: true },
    });
    if (!row) {
      throw new handleResponse(404, 'Session not found');
    }
    try {
      const result = await auth.api.revokeUserSession({
        body: { sessionToken: row.token },
        headers: fromNodeHeaders(req.headers),
      });
      this.auditAdmin({
        action: 'admin.user.session.revoke',
        actorId: session.user.id,
        target: { type: 'session', id: sessionId, userId },
      });
      throw new handleResponse(200, 'Session ended', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async impersonateUser(
    req: Request,
    res: Response,
    session: Session,
    userId: string,
  ): Promise<Record<string, unknown>> {
    assertNotSelf(session.user.id, userId, 'Cannot impersonate yourself');
    try {
      const result = await auth.api.impersonateUser({
        body: { userId },
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      });
      applyAuthCookies(res, result.headers);
      const { ok, status, payload } = await readAuthApiResponse(result);
      if (!ok) {
        rethrowAuthApiFailure(status, payload);
      }
      this.auditAdmin({
        action: 'admin.user.impersonate',
        actorId: session.user.id,
        target: { type: 'user', id: userId },
      });
      return new handleResponse(
        200,
        'Impersonation started',
        payload,
      ).getResponse();
    } catch (error) {
      this.rethrow(error);
    }
  }

  async stopImpersonating(
    req: Request,
    res: Response,
    session: Session,
  ): Promise<Record<string, unknown>> {
    const actorId = impersonatedByOf(session);
    if (!actorId) {
      throw new handleResponse(400, 'Not impersonating');
    }
    try {
      const result = await auth.api.stopImpersonating({
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      });
      applyAuthCookies(res, result.headers);
      const { ok, status, payload } = await readAuthApiResponse(result);
      if (!ok) {
        rethrowAuthApiFailure(status, payload);
      }
      this.auditAdmin({
        action: 'admin.user.impersonate.stop',
        actorId,
        target: { type: 'user', id: session.user.id },
      });
      return new handleResponse(
        200,
        'Impersonation stopped',
        payload,
      ).getResponse();
    } catch (error) {
      this.rethrow(error);
    }
  }

  async createOrganisation(
    session: Session,
    body: CreateOrganisationDto,
  ): Promise<never> {
    const name = body.name.trim();
    const slug = body.slug.trim();
    try {
      const organisation = await this.db().organization.create({
        data: {
          id: createId(),
          name,
          slug,
          logo: body.logo?.trim() || null,
          metadata: body.metadata ? JSON.stringify(body.metadata) : null,
          createdAt: new Date(),
        },
      });
      this.auditAdmin({
        action: 'admin.organisation.create',
        actorId: session.user.id,
        target: { type: 'organization', id: organisation.id },
      });
      throw new handleResponse(
        201,
        'Organisation created',
        presentOrganisation(organisation),
      );
    } catch (error) {
      if (error instanceof handleResponse) {
        throw error;
      }
      if (isUniqueConflict(error)) {
        throw new handleResponse(409, 'Slug already taken');
      }
      throw error;
    }
  }

  async getOrganisation(organizationId: string): Promise<never> {
    const organisation = await this.db().organization.findUnique({
      where: { id: organizationId },
      include: {
        members: true,
        teams: true,
        invitations: true,
      },
    });
    if (!organisation) {
      throw new handleResponse(404, 'Organisation not found');
    }
    throw new handleResponse(
      200,
      'Organisation loaded',
      presentOrganisation(organisation),
    );
  }

  async listOrganisations(query: ListOrganisationsQueryDto): Promise<never> {
    const take = query.limit ?? DEFAULT_LIST_LIMIT;
    const skip = query.offset ?? 0;
    const [organisations, total] = await Promise.all([
      this.db().organization.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.db().organization.count(),
    ]);
    throw new handleResponse(200, 'Organisations loaded', {
      organisations: organisations.map((row) => presentOrganisation(row)),
      total,
      limit: take,
      offset: skip,
    });
  }

  async updateOrganisation(
    session: Session,
    organizationId: string,
    body: UpdateOrganisationDto,
  ): Promise<never> {
    const data = pickOrganisationUpdate(body);
    if (!data) {
      throw new handleResponse(400, 'No organisation changes');
    }
    const existing = await this.db().organization.findUnique({
      where: { id: organizationId },
    });
    if (!existing) {
      throw new handleResponse(404, 'Organisation not found');
    }
    const organisation = await this.db().organization.update({
      where: { id: organizationId },
      data: {
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        metadata:
          data.metadata === undefined
            ? undefined
            : JSON.stringify(data.metadata),
      },
    });
    this.auditAdmin({
      action: 'admin.organisation.update',
      actorId: session.user.id,
      target: { type: 'organization', id: organizationId },
    });
    throw new handleResponse(
      200,
      'Organisation updated',
      presentOrganisation(organisation),
    );
  }

  async deleteOrganisation(
    session: Session,
    organizationId: string,
  ): Promise<never> {
    const existing = await this.db().organization.findUnique({
      where: { id: organizationId },
      include: { teams: { select: { id: true } } },
    });
    if (!existing) {
      throw new handleResponse(404, 'Organisation not found');
    }
    const teamIds = existing.teams.map((team) => team.id);
    await this.db().$transaction([
      this.db().creditLedger.deleteMany({
        where: { audience: 'organization', targetId: organizationId },
      }),
      ...(teamIds.length > 0
        ? [
            this.db().creditLedger.deleteMany({
              where: { audience: 'team', targetId: { in: teamIds } },
            }),
          ]
        : []),
      this.db().organization.delete({ where: { id: organizationId } }),
    ]);
    this.auditAdmin({
      action: 'admin.organisation.delete',
      actorId: session.user.id,
      target: { type: 'organization', id: organizationId },
    });
    throw new handleResponse(200, 'Organisation deleted', {
      id: organizationId,
    });
  }

  async listOrganisationMembers(organizationId: string): Promise<never> {
    await this.requireOrganisation(organizationId);
    const members = await this.db().member.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    throw new handleResponse(200, 'Members loaded', members);
  }

  async addOrganisationMember(
    session: Session,
    organizationId: string,
    body: AdminAddMemberDto,
  ): Promise<never> {
    const role = parseOrgMemberRole(body.role);
    if (!role) {
      throw new handleResponse(400, 'Invalid member role');
    }
    await this.requireOrganisation(organizationId);
    const user = await this.db().user.findUnique({
      where: { id: body.userId },
      select: { id: true },
    });
    if (!user) {
      throw new handleResponse(404, 'User not found');
    }
    try {
      const member = await this.db().member.create({
        data: {
          id: createId(),
          organizationId,
          userId: body.userId,
          role,
          createdAt: new Date(),
        },
      });
      this.auditAdmin({
        action: 'admin.member.add',
        actorId: session.user.id,
        target: {
          type: 'member',
          id: member.id,
          organizationId,
          userId: body.userId,
          role,
        },
      });
      throw new handleResponse(201, 'Member added', member);
    } catch (error) {
      if (error instanceof handleResponse) {
        throw error;
      }
      if (isUniqueConflict(error)) {
        throw new handleResponse(409, 'Member already exists');
      }
      throw error;
    }
  }

  async updateOrganisationMemberRole(
    session: Session,
    organizationId: string,
    memberId: string,
    body: UpdateMemberRoleDto,
  ): Promise<never> {
    const role = parseOrgMemberRole(body.role);
    if (!role) {
      throw new handleResponse(400, 'Invalid member role');
    }
    const member = await this.db().member.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new handleResponse(404, 'Member not found');
    }
    await this.assertNotLastOwner(organizationId, member.role, role);
    const updated = await this.db().member.update({
      where: { id: memberId },
      data: { role },
    });
    this.auditAdmin({
      action: 'admin.member.role.update',
      actorId: session.user.id,
      target: { type: 'member', id: memberId, organizationId, role },
    });
    throw new handleResponse(200, 'Member role updated', updated);
  }

  async removeOrganisationMember(
    session: Session,
    organizationId: string,
    memberId: string,
  ): Promise<never> {
    const member = await this.db().member.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new handleResponse(404, 'Member not found');
    }
    await this.assertNotLastOwner(organizationId, member.role, null);
    await this.db().member.delete({ where: { id: memberId } });
    this.auditAdmin({
      action: 'admin.member.remove',
      actorId: session.user.id,
      target: {
        type: 'member',
        id: memberId,
        organizationId,
        userId: member.userId,
      },
    });
    throw new handleResponse(200, 'Member removed', { id: memberId });
  }

  async listOrganisationInvitations(organizationId: string): Promise<never> {
    await this.requireOrganisation(organizationId);
    const invitations = await this.db().invitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    throw new handleResponse(200, 'Invitations loaded', invitations);
  }

  async inviteOrganisationMember(
    session: Session,
    organizationId: string,
    body: AdminInviteMemberDto,
  ): Promise<never> {
    const role = parseOrgMemberRole(body.role);
    if (!role) {
      throw new handleResponse(400, 'Invalid member role');
    }
    await this.requireOrganisation(organizationId);
    if (body.teamId) {
      const team = await this.db().team.findFirst({
        where: { id: body.teamId, organizationId },
        select: { id: true },
      });
      if (!team) {
        throw new handleResponse(404, 'Team not found');
      }
    }
    const email = body.email.trim().toLowerCase();
    const pending = await this.db().invitation.findFirst({
      where: { organizationId, email, status: 'pending' },
    });
    if (pending && !body.resend) {
      throw new handleResponse(409, 'Invitation already pending');
    }
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = pending
      ? await this.db().invitation.update({
          where: { id: pending.id },
          data: { role, teamId: body.teamId, expiresAt },
        })
      : await this.db().invitation.create({
          data: {
            id: createId(),
            organizationId,
            email,
            role,
            teamId: body.teamId,
            status: 'pending',
            expiresAt,
            inviterId: session.user.id,
            createdAt: new Date(),
          },
        });
    this.auditAdmin({
      action: 'admin.invitation.create',
      actorId: session.user.id,
      target: { type: 'invitation', id: invitation.id, organizationId },
    });
    throw new handleResponse(
      pending ? 200 : 201,
      pending ? 'Invitation resent' : 'Invitation sent',
      invitation,
    );
  }

  async cancelOrganisationInvitation(
    session: Session,
    organizationId: string,
    invitationId: string,
  ): Promise<never> {
    const invitation = await this.db().invitation.findFirst({
      where: { id: invitationId, organizationId },
    });
    if (!invitation) {
      throw new handleResponse(404, 'Invitation not found');
    }
    if (invitation.status !== 'pending') {
      throw new handleResponse(400, 'Invitation not pending');
    }
    const updated = await this.db().invitation.update({
      where: { id: invitationId },
      data: { status: 'canceled' },
    });
    this.auditAdmin({
      action: 'admin.invitation.cancel',
      actorId: session.user.id,
      target: { type: 'invitation', id: invitationId, organizationId },
    });
    throw new handleResponse(200, 'Invitation canceled', updated);
  }

  async createTeam(session: Session, body: AdminCreateTeamDto): Promise<never> {
    await this.requireOrganisation(body.organizationId);
    const name = body.name.trim();
    if (!name) {
      throw new handleResponse(400, 'No team changes');
    }
    const team = await this.db().team.create({
      data: {
        id: createId(),
        name,
        organizationId: body.organizationId,
        createdAt: new Date(),
      },
    });
    this.auditAdmin({
      action: 'admin.team.create',
      actorId: session.user.id,
      target: {
        type: 'team',
        id: team.id,
        organizationId: body.organizationId,
      },
    });
    throw new handleResponse(201, 'Team created', team);
  }

  async getTeam(teamId: string): Promise<never> {
    const team = await this.db().team.findUnique({
      where: { id: teamId },
      include: { teammembers: true },
    });
    if (!team) {
      throw new handleResponse(404, 'Team not found');
    }
    throw new handleResponse(200, 'Team loaded', team);
  }

  async listTeams(query: ListTeamsQueryDto): Promise<never> {
    const take = query.limit ?? DEFAULT_LIST_LIMIT;
    const skip = query.offset ?? 0;
    const where = query.organizationId
      ? { organizationId: query.organizationId }
      : undefined;
    const [teams, total] = await Promise.all([
      this.db().team.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.db().team.count({ where }),
    ]);
    throw new handleResponse(200, 'Teams loaded', {
      teams,
      total,
      limit: take,
      offset: skip,
    });
  }

  async updateTeam(
    session: Session,
    teamId: string,
    body: UpdateTeamDto,
  ): Promise<never> {
    const data = pickTeamUpdate(body);
    if (!data) {
      throw new handleResponse(400, 'No team changes');
    }
    const existing = await this.db().team.findUnique({ where: { id: teamId } });
    if (!existing) {
      throw new handleResponse(404, 'Team not found');
    }
    const team = await this.db().team.update({
      where: { id: teamId },
      data: { name: data.name },
    });
    this.auditAdmin({
      action: 'admin.team.update',
      actorId: session.user.id,
      target: { type: 'team', id: teamId },
    });
    throw new handleResponse(200, 'Team updated', team);
  }

  async deleteTeam(session: Session, teamId: string): Promise<never> {
    const existing = await this.db().team.findUnique({ where: { id: teamId } });
    if (!existing) {
      throw new handleResponse(404, 'Team not found');
    }
    await this.db().$transaction([
      this.db().creditLedger.deleteMany({
        where: { audience: 'team', targetId: teamId },
      }),
      this.db().team.delete({ where: { id: teamId } }),
    ]);
    this.auditAdmin({
      action: 'admin.team.delete',
      actorId: session.user.id,
      target: { type: 'team', id: teamId },
    });
    throw new handleResponse(200, 'Team deleted', { id: teamId });
  }

  async listTeamMembers(teamId: string): Promise<never> {
    await this.requireTeam(teamId);
    const members = await this.db().teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    throw new handleResponse(200, 'Team members loaded', members);
  }

  async addTeamMember(
    session: Session,
    teamId: string,
    userId: string,
  ): Promise<never> {
    const team = await this.requireTeam(teamId);
    const user = await this.db().user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new handleResponse(404, 'User not found');
    }
    const orgMember = await this.db().member.findFirst({
      where: { organizationId: team.organizationId, userId },
      select: { id: true },
    });
    if (!orgMember) {
      throw new handleResponse(400, 'Not an org member');
    }
    try {
      const member = await this.db().teamMember.create({
        data: {
          id: createId(),
          teamId,
          userId,
          createdAt: new Date(),
        },
      });
      this.auditAdmin({
        action: 'admin.team.member.add',
        actorId: session.user.id,
        target: { type: 'teamMember', id: member.id, teamId, userId },
      });
      throw new handleResponse(201, 'Team member added', member);
    } catch (error) {
      if (error instanceof handleResponse) {
        throw error;
      }
      if (isUniqueConflict(error)) {
        throw new handleResponse(409, 'Already a team member');
      }
      throw error;
    }
  }

  async removeTeamMember(
    session: Session,
    teamId: string,
    userId: string,
  ): Promise<never> {
    const member = await this.db().teamMember.findFirst({
      where: { teamId, userId },
    });
    if (!member) {
      throw new handleResponse(404, 'Team member missing');
    }
    await this.db().teamMember.delete({ where: { id: member.id } });
    this.auditAdmin({
      action: 'admin.team.member.remove',
      actorId: session.user.id,
      target: { type: 'teamMember', id: member.id, teamId, userId },
    });
    throw new handleResponse(200, 'Team member removed', { id: member.id });
  }

  async listAuditLogs(
    req: Request,
    query: ListAuditLogsQueryDto,
  ): Promise<never> {
    try {
      const result = await auth.api.getAllAuditLogs({
        query: {
          limit: query.limit,
          offset: query.offset,
          userId: query.userId,
          organizationId: query.organizationId,
          eventType: query.eventType,
          identifier: query.identifier,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Audit logs loaded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async inviteStaff(req: Request, body: InviteStaffDto): Promise<never> {
    try {
      const stubPassword = `${randomBytes(24).toString('base64url')}Aa1!`;
      const result = await auth.api.createUser({
        body: {
          email: body.email,
          name: body.name,
          password: stubPassword,
          role: body.role as
            'admin' | 'support' | 'developer' | 'finance_officer' | 'user',
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(201, 'Staff user created', {
        user: result.user,
        // Stub password is intentionally not returned — invite email TBD.
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  async listRoles(): Promise<never> {
    const roles = await this.db().platformRole.findMany({
      orderBy: { name: 'asc' },
    });
    throw new handleResponse(200, 'Roles loaded', roles);
  }

  async createRole(body: CreateRoleDto): Promise<never> {
    const role = await this.db().platformRole.create({
      data: {
        name: body.name,
        description: body.description,
        statements: body.statements,
        active: body.active ?? true,
        isSystem: false,
      },
    });
    throw new handleResponse(201, 'Role created', role);
  }

  async updateRole(id: string, body: UpdateRoleDto): Promise<never> {
    const existing = await this.db().platformRole.findUnique({ where: { id } });
    if (!existing) {
      throw new handleResponse(404, 'Role not found');
    }
    if (existing.isSystem && body.name && body.name !== existing.name) {
      throw new handleResponse(400, 'System role locked');
    }
    const role = await this.db().platformRole.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        active: body.active,
      },
    });
    throw new handleResponse(200, 'Role updated', role);
  }

  async updateRolePermissions(
    id: string,
    body: UpdateRolePermissionsDto,
  ): Promise<never> {
    const existing = await this.db().platformRole.findUnique({ where: { id } });
    if (!existing) {
      throw new handleResponse(404, 'Role not found');
    }
    const role = await this.db().platformRole.update({
      where: { id },
      data: {
        statements: body.statements,
      },
    });
    throw new handleResponse(200, 'Role permissions updated', role);
  }

  async listPlans(): Promise<never> {
    const plans = await this.db().plan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    throw new handleResponse(200, 'Plans loaded', plans);
  }

  async createPlan(body: CreatePlanDto): Promise<never> {
    const plan = await this.db().plan.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        audience: body.audience,
        billingType: body.billingType,
        autumnProductId: body.autumnProductId,
        limits: body.limits ?? undefined,
        trialDays: body.trialDays,
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    throw new handleResponse(201, 'Plan created', plan);
  }

  async updatePlan(id: string, body: UpdatePlanDto): Promise<never> {
    const existing = await this.db().plan.findUnique({ where: { id } });
    if (!existing) {
      throw new handleResponse(404, 'Plan not found');
    }
    const plan = await this.db().plan.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        audience: body.audience,
        billingType: body.billingType,
        autumnProductId: body.autumnProductId,
        limits:
          body.limits === undefined
            ? undefined
            : (body.limits as Prisma.InputJsonValue),
        trialDays: body.trialDays,
        active: body.active,
        sortOrder: body.sortOrder,
      },
    });
    throw new handleResponse(200, 'Plan updated', plan);
  }

  async updateMultiSession(body: MultiSessionSettingDto): Promise<never> {
    const setting = await this.db().platformSetting.upsert({
      where: { key: MULTI_SESSION_KEY },
      create: {
        key: MULTI_SESSION_KEY,
        value: body.enabled ? 'true' : 'false',
      },
      update: {
        value: body.enabled ? 'true' : 'false',
      },
    });
    throw new handleResponse(200, 'Multi-session setting updated', {
      key: setting.key,
      enabled: setting.value === 'true',
    });
  }

  async getSignupCreditsSetting(): Promise<never> {
    const amount = await getSignupCredits(this.db());
    throw new handleResponse(200, 'Credits setting loaded', { amount });
  }

  async updateSignupCredits(
    session: Session,
    body: SignupCreditsSettingDto,
  ): Promise<never> {
    const amount = await setSignupCredits(this.db(), body.amount);
    this.auditCredits({
      action: 'credits.signup_setting.update',
      actorId: session.user.id,
      target: { type: 'setting', id: SIGNUP_CREDITS_KEY, amount },
    });
    throw new handleResponse(200, 'Credits setting updated', { amount });
  }

  async rewardCreditsToAudience(
    session: Session,
    body: RewardCreditsDto,
  ): Promise<never> {
    const audience = parseCreditAudience(body.audience);
    if (!audience) {
      throw new handleResponse(400, 'Invalid credit audience');
    }

    try {
      const result = await rewardCredits(this.db(), {
        audience,
        targetId: body.targetId,
        amount: body.amount,
        reason: body.reason,
        actorId: session.user.id,
      });
      this.auditCredits({
        action: 'credits.reward',
        actorId: session.user.id,
        target: {
          type: audience,
          id: result.targetId,
          amount: result.amount,
          balance: result.balance,
        },
      });
      throw new handleResponse(200, 'Credits rewarded', result);
    } catch (error) {
      if (error instanceof handleResponse) {
        throw error;
      }
      const mapped = mapCreditRewardError(error);
      if (mapped) {
        throw new handleResponse(mapped.status, mapped.message);
      }
      this.rethrow(error);
    }
  }

  private async requireOrganisation(organizationId: string) {
    const organisation = await this.db().organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organisation) {
      throw new handleResponse(404, 'Organisation not found');
    }
    return organisation;
  }

  private async requireTeam(teamId: string) {
    const team = await this.db().team.findUnique({
      where: { id: teamId },
      select: { id: true, organizationId: true },
    });
    if (!team) {
      throw new handleResponse(404, 'Team not found');
    }
    return team;
  }

  private async assertNotLastOwner(
    organizationId: string,
    currentRole: string,
    nextRole: string | null,
  ): Promise<void> {
    const removingOwner =
      currentRole === 'owner' && (nextRole === null || nextRole !== 'owner');
    if (!removingOwner) {
      return;
    }
    const owners = await this.db().member.count({
      where: { organizationId, role: 'owner' },
    });
    if (owners <= 1) {
      throw new handleResponse(400, 'Keep one owner');
    }
  }

  private auditCredits(input: {
    action: string;
    actorId: string;
    target: { type: string; id: string; [key: string]: unknown };
  }): void {
    this.auditAdmin(input);
  }

  private auditAdmin(input: {
    action: string;
    actorId: string;
    target: { type: string; id: string; [key: string]: unknown };
  }): void {
    try {
      useLogger().audit({
        action: input.action,
        actor: { type: 'user', id: input.actorId },
        target: input.target,
        outcome: 'success',
      });
    } catch {
      // Outside an evlog request scope — logger is unavailable
    }
  }

  private db() {
    return this.prisma.client();
  }

  private rethrow(error: unknown): never {
    rethrowAsHandleResponse(error);
  }
}
