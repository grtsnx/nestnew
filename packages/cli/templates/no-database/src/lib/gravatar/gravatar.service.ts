import { Injectable } from '@nestjs/common';
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
  d: 'identicon' as const,
};

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

@Injectable()
export class GravatarService {
  getGravatarUrl(email: string, options?: GravatarOptions): string {
    const gravatarOptions = {
      s: options?.size ?? DEFAULT_OPTIONS.s,
      r: options?.rating ?? DEFAULT_OPTIONS.r,
      d: options?.default ?? DEFAULT_OPTIONS.d,
    };

    return ensureHttpsUrl(gravatar.url(email, gravatarOptions));
  }
}
