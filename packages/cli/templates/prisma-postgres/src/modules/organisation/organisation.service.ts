import { Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

import { auth } from 'src/lib';
import type {
  CreateOrganisationDto,
  SetActiveOrganisationDto,
  UpdateOrganisationDto,
} from 'src/dto';
import { handleResponse, rethrowAsHandleResponse } from 'src/middleware';

export function pickOrganisationUpdate(body: {
  name?: string;
  slug?: string;
  logo?: string;
  metadata?: Record<string, unknown>;
}): {
  name?: string;
  slug?: string;
  logo?: string;
  metadata?: Record<string, unknown>;
} | null {
  const data: {
    name?: string;
    slug?: string;
    logo?: string;
    metadata?: Record<string, unknown>;
  } = {};
  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.slug === 'string' && body.slug.trim()) {
    data.slug = body.slug.trim();
  }
  if (typeof body.logo === 'string' && body.logo.trim()) {
    data.logo = body.logo.trim();
  }
  if (body.metadata && typeof body.metadata === 'object') {
    data.metadata = body.metadata;
  }
  return Object.keys(data).length > 0 ? data : null;
}

@Injectable()
export class OrganisationService {
  async create(req: Request, body: CreateOrganisationDto): Promise<never> {
    try {
      const result = await auth.api.createOrganization({
        body: {
          name: body.name,
          slug: body.slug,
          logo: body.logo,
          metadata: body.metadata,
          keepCurrentActiveOrganization: body.keepCurrentActiveOrganization,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(201, 'Organisation created', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async list(req: Request): Promise<never> {
    try {
      const result = await auth.api.listOrganizations({
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Organisations loaded', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async setActive(
    req: Request,
    body: SetActiveOrganisationDto,
  ): Promise<never> {
    try {
      const result = await auth.api.setActiveOrganization({
        body: {
          organizationId: body.organizationId,
          organizationSlug: body.organizationSlug,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Active organisation updated', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async update(
    req: Request,
    organizationId: string,
    body: UpdateOrganisationDto,
  ): Promise<never> {
    const data = pickOrganisationUpdate(body);
    if (!data) {
      throw new handleResponse(400, 'No organisation changes');
    }
    try {
      const result = await auth.api.updateOrganization({
        body: {
          organizationId,
          data,
        },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Organisation updated', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async delete(req: Request, organizationId: string): Promise<never> {
    try {
      const result = await auth.api.deleteOrganization({
        body: { organizationId },
        headers: fromNodeHeaders(req.headers),
      });
      throw new handleResponse(200, 'Organisation deleted', result);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    rethrowAsHandleResponse(error);
  }
}
