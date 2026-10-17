import { Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

import { auth } from 'src/lib';
import type {
  AddTeamMemberDto,
  CreateTeamDto,
  RemoveTeamMemberDto,
  UpdateTeamDto,
} from 'src/dto';
import { handleResponse, rethrowAsHandleResponse } from 'src/middleware';

export function pickTeamUpdate(body: { name?: string }): {
  name?: string;
} | null {
  if (typeof body.name === 'string' && body.name.trim()) {
    return { name: body.name.trim() };
  }
  return null;
}

@Injectable()
export class TeamService {
  async create(req: Request, body: CreateTeamDto): Promise<never> {
    try {
      const result = await auth.api.createTeam({
        body: {
          name: body.name,
          organizationId: body.organizationId,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(201, 'Team created', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async list(req: Request): Promise<never> {
    try {
      const result = await auth.api.listOrganizationTeams({
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Teams loaded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async addMember(
    req: Request,
    teamId: string,
    body: AddTeamMemberDto,
  ): Promise<never> {
    try {
      const result = await auth.api.addTeamMember({
        body: {
          teamId,
          userId: body.userId,
          organizationId: body.organizationId,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(201, 'Team member added', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async removeMember(req: Request, body: RemoveTeamMemberDto): Promise<never> {
    try {
      const result = await auth.api.removeTeamMember({
        body: {
          teamId: body.teamId,
          userId: body.userId,
          organizationId: body.organizationId,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Team member removed', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async update(
    req: Request,
    teamId: string,
    body: UpdateTeamDto,
  ): Promise<never> {
    const data = pickTeamUpdate(body);
    if (!data) {
      throw new handleResponse(400, 'No team changes');
    }
    try {
      const result = await auth.api.updateTeam({
        body: {
          teamId,
          data,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Team updated', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async delete(
    req: Request,
    teamId: string,
    organizationId?: string,
  ): Promise<never> {
    try {
      const result = await auth.api.removeTeam({
        body: {
          teamId,
          organizationId,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Team deleted', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    rethrowAsHandleResponse(error);
  }
}
