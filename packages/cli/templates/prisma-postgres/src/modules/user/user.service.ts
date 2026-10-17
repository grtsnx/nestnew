import { Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

import {
  auth,
  DEFAULT_SIGNUP_CREDITS,
  getSignupCredits,
  grantSignupCreditsIfEligible,
  PrismaService,
  resolveAccountForUnlink,
  type Session,
} from 'src/lib';
import type {
  ChangePasswordDto,
  CheckTelephoneQueryDto,
  CheckUsernameQueryDto,
  LinkAccountDto,
  OnboardingDto,
  TwoFactorDto,
  UpdateProfileDto,
  DeleteAccountDto,
  VerifyTwoFactorDto,
} from 'src/dto';
import {
  handleResponse,
  enrichSessionClient,
  enrichSessionClients,
  rethrowAsHandleResponse,
} from 'src/middleware';

type OverviewOrganization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  creditBalance: number;
};

type OverviewMembership = {
  id: string;
  role: string;
  organization: OverviewOrganization;
};

type OverviewTeamMembership = {
  id: string;
  team: {
    id: string;
    name: string;
    organizationId: string;
    creditBalance: number;
  };
};

type OverviewSession = Record<string, unknown> & {
  id?: string;
  token?: string;
  activeOrganizationId?: string | null;
  activeTeamId?: string | null;
};

export function pickProfileUpdate(body: {
  name?: string;
  image?: string;
  username?: string;
  telephone?: string;
}): {
  name?: string;
  image?: string;
  username?: string;
  telephone?: string;
} | null {
  const data: {
    name?: string;
    image?: string;
    username?: string;
    telephone?: string;
  } = {};
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
  return Object.keys(data).length > 0 ? data : null;
}

export function buildUserOverview(input: {
  user: Record<string, unknown> & { creditBalance?: number };
  session: OverviewSession;
  memberships: OverviewMembership[];
  teamMemberships: OverviewTeamMembership[];
  grantedCredits?: number;
}) {
  const { creditBalance: userCreditBalance, ...user } = input.user;
  const session = enrichSessionClient(input.session, input.session.token);
  const creditBalance =
    typeof userCreditBalance === 'number'
      ? userCreditBalance
      : DEFAULT_SIGNUP_CREDITS;
  const granted = input.grantedCredits ?? DEFAULT_SIGNUP_CREDITS;

  return {
    user,
    session,
    organizations: input.memberships.map((membership) => ({
      ...membership.organization,
      role: membership.role,
    })),
    teams: input.teamMemberships.map((row) => row.team),
    billing: {
      audience: 'individual' as const,
      credits: {
        balance: creditBalance,
        granted,
      },
    },
  };
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  me(session: Session): never {
    throw new handleResponse(200, 'Profile loaded', { user: session.user });
  }

  async updateProfile(req: Request, body: UpdateProfileDto): Promise<never> {
    const data = pickProfileUpdate(body);
    if (!data) {
      throw new handleResponse(400, 'No profile changes');
    }
    try {
      const result = await auth.api.updateUser({
        body: data,
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Profile updated', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async overview(session: Session): Promise<never> {
    const db = this.prisma.client();
    const userId = session.user.id;
    await grantSignupCreditsIfEligible(db, userId);
    const [user, memberships, teamMemberships, grantedCredits] =
      await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            image: true,
            createdAt: true,
            updatedAt: true,
            username: true,
            displayUsername: true,
            twoFactorEnabled: true,
            lastLoginMethod: true,
            role: true,
            banned: true,
            banReason: true,
            banExpires: true,
            lastActiveAt: true,
            telephone: true,
            creditBalance: true,
          },
        }),
        db.member.findMany({
          where: { userId },
          select: {
            id: true,
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
                creditBalance: true,
              },
            },
          },
        }),
        db.teamMember.findMany({
          where: { userId },
          select: {
            id: true,
            team: {
              select: {
                id: true,
                name: true,
                organizationId: true,
                creditBalance: true,
              },
            },
          },
        }),
        getSignupCredits(db),
      ]);

    if (!user) {
      throw new handleResponse(404, 'Account missing');
    }

    throw new handleResponse(
      200,
      'Overview loaded',
      buildUserOverview({
        user,
        session: session.session,
        memberships,
        teamMemberships,
        grantedCredits,
      }),
    );
  }

  async onboarding(req: Request, body: OnboardingDto): Promise<never> {
    try {
      const result = await auth.api.updateUser({
        body: {
          username: body.username,
          telephone: body.telephone,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Onboarding updated', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async checkUsername(query: CheckUsernameQueryDto): Promise<never> {
    try {
      const result = await auth.api.isUsernameAvailable({
        body: { username: query.username },
      });
      throw new handleResponse(200, 'Username checked', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async checkTelephone(query: CheckTelephoneQueryDto): Promise<never> {
    const existing = await this.prisma.client().user.findUnique({
      where: { telephone: query.telephone },
      select: { id: true },
    });
    throw new handleResponse(200, 'Telephone checked', {
      available: !existing,
    });
  }

  async enableTwoFactor(req: Request, body: TwoFactorDto): Promise<never> {
    try {
      const result = await auth.api.enableTwoFactor({
        body: {
          password: body.password,
          issuer: body.issuer,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Two-factor enabled', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async disableTwoFactor(req: Request, body: TwoFactorDto): Promise<never> {
    try {
      const result = await auth.api.disableTwoFactor({
        body: { password: body.password },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Two-factor disabled', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async verifyTwoFactor(
    req: Request,
    body: VerifyTwoFactorDto,
  ): Promise<never> {
    try {
      const result = await auth.api.verifyTOTP({
        body: { code: body.code },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Two-factor verified', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async listAccounts(req: Request): Promise<never> {
    try {
      const result = await auth.api.listUserAccounts({
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Accounts loaded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async linkAccount(req: Request, body: LinkAccountDto): Promise<never> {
    try {
      const result = await auth.api.linkSocialAccount({
        body: {
          provider: body.provider,
          callbackURL: body.callbackURL,
          disableRedirect: true,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Link started', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async unlinkAccount(req: Request, provider: string): Promise<never> {
    try {
      const accounts = await auth.api.listUserAccounts({
        headers: fromNodeHeaders(req.headers),
      });
      const account = resolveAccountForUnlink(
        Array.isArray(accounts) ? accounts : [],
        provider,
      );
      if (!account?.id) {
        throw new handleResponse(404, 'Account not found');
      }
      const result = await auth.api.unlinkAccount({
        body: { accountId: account.id },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Account unlinked', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async listSessions(req: Request, session: Session): Promise<never> {
    try {
      const result = await auth.api.listSessions({
        headers: fromNodeHeaders(req.headers),
      });
      const sessions = Array.isArray(result)
        ? enrichSessionClients(
            result as Record<string, unknown>[],
            session.session.token,
          )
        : result;
      throw new handleResponse(200, 'Sessions loaded', sessions);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async revokeSession(
    req: Request,
    session: Session,
    sessionId: string,
  ): Promise<never> {
    try {
      const row = await this.prisma.client().session.findFirst({
        where: { id: sessionId, userId: session.user.id },
        select: { token: true },
      });
      if (!row) {
        throw new handleResponse(404, 'Session not found');
      }
      const result = await auth.api.revokeSession({
        body: { token: row.token },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Session ended', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async revokeSessions(req: Request, mode: 'others' | 'all'): Promise<never> {
    try {
      const headers = fromNodeHeaders(req.headers);
      const result =
        mode === 'all'
          ? await auth.api.revokeSessions({ headers })
          : await auth.api.revokeOtherSessions({ headers });
      throw new handleResponse(
        200,
        mode === 'all' ? 'All sessions ended' : 'Other sessions ended',
        result,
      );
    } catch (error) {
      this.rethrow(error);
    }
  }

  async signOut(req: Request): Promise<never> {
    try {
      await auth.api.signOut({
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Signed out');
    } catch (error) {
      this.rethrow(error);
    }
  }

  async deleteAccount(req: Request, body: DeleteAccountDto): Promise<never> {
    try {
      const result = await auth.api.deleteUser({
        body: {
          password: body.password,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Account deleted', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async changePassword(req: Request, body: ChangePasswordDto): Promise<never> {
    try {
      const result = await auth.api.changePassword({
        body: {
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
          revokeOtherSessions: body.revokeOtherSessions,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Password updated', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    rethrowAsHandleResponse(error);
  }
}
