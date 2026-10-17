import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as gravatar from 'gravatar';

export type GravatarRating = 'g' | 'pg' | 'r' | 'x';

export type GravatarDefaultImage =
  | '404'
  | 'mm'
  | 'identicon'
  | 'monsterid'
  | 'wavatar'
  | 'retro'
  | 'robohash'
  | 'blank';

export interface GravatarOptions {
  size?: string;
  rating?: GravatarRating;
  default?: GravatarDefaultImage;
}

const DEFAULT_OPTIONS = {
  s: '200',
  r: 'pg' as const,
};

export const DEFAULT_DICEBEAR_STYLE = 'loops';
const DICEBEAR_API_BASE = 'https://api.dicebear.com/10.x';

export function ensureHttpsUrl(url: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  if (url.startsWith('http://')) {
    return url.replace(/^http:\/\//, 'https://');
  }

  if (!url.startsWith('https://')) {
    return `https://${url}`;
  }

  return url;
}

export function resolveDicebearStyle(envStyle?: string): string {
  const trimmed = envStyle?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : DEFAULT_DICEBEAR_STYLE;
}

/**
 * Builds a DiceBear HTTP API PNG URL used as Gravatar's `d=` fallback.
 * Gravatar Photon only accepts jpg/jpeg/png/gif defaults — not SVG.
 * Animated `tags=animation` is applied when the style is `loops`.
 */
export function buildDicebearUrl(
  email: string,
  style: string,
  size: string,
): string {
  const params = new URLSearchParams({
    seed: email,
    size,
  });

  if (style === DEFAULT_DICEBEAR_STYLE) {
    params.set('tags', 'animation');
  }

  return `${DICEBEAR_API_BASE}/${encodeURIComponent(style)}/png?${params.toString()}`;
}

export function resolveProfileImage(
  email: string,
  style?: string,
  size = DEFAULT_OPTIONS.s,
): string {
  const dicebear = buildDicebearUrl(email, resolveDicebearStyle(style), size);
  return ensureHttpsUrl(
    gravatar.url(email, {
      s: size,
      r: DEFAULT_OPTIONS.r,
      d: dicebear,
    }),
  );
}

export function assignSignupImage(user: {
  email: string;
  image?: string | null;
}): string | null {
  if (typeof user.image === 'string' && user.image.trim().length > 0) {
    return null;
  }
  return resolveProfileImage(user.email, process.env.DICEBEAR_STYLE);
}

@Injectable()
export class GravatarService {
  constructor(private readonly configService: ConfigService) {}

  getGravatarUrl(email: string, options?: GravatarOptions): string {
    const size = options?.size ?? DEFAULT_OPTIONS.s;
    const rating = options?.rating ?? DEFAULT_OPTIONS.r;
    const defaultImage =
      options?.default ??
      buildDicebearUrl(
        email,
        resolveDicebearStyle(this.configService.get<string>('DICEBEAR_STYLE')),
        size,
      );

    return ensureHttpsUrl(
      gravatar.url(email, {
        s: size,
        r: rating,
        d: defaultImage,
      }),
    );
  }
}
