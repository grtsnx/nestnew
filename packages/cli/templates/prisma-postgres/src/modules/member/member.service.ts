import { Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

import { auth } from 'src/lib';
import type { InviteMemberDto, UpdateMemberRoleDto } from 'src/dto';
import { handleResponse, rethrowAsHandleResponse } from 'src/middleware';

@Injectable()
export class MemberService {
  async invite(req: Request, body: InviteMemberDto): Promise<never> {
    try {
      const result = await auth.api.createInvitation({
        body: {
          email: body.email,
          role: body.role as 'owner' | 'admin' | 'member',
          organizationId: body.organizationId,
          resend: body.resend,
          teamId: body.teamId,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(201, 'Invitation sent', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async list(req: Request): Promise<never> {
    try {
      const result = await auth.api.listMembers({
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Members loaded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async updateRole(
    req: Request,
    memberId: string,
    body: UpdateMemberRoleDto,
  ): Promise<never> {
    try {
      const result = await auth.api.updateMemberRole({
        body: {
          memberId,
          role: body.role,
          organizationId: body.organizationId,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Member role updated', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async remove(req: Request, memberId: string): Promise<never> {
    try {
      const result = await auth.api.removeMember({
        body: { memberIdOrEmail: memberId },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Member removed', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    rethrowAsHandleResponse(error);
  }
}
