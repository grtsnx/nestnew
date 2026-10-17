import { ConfigService } from '@nestjs/config';

import {
  GravatarService,
  ensureHttpsUrl,
  buildDicebearUrl,
  resolveDicebearStyle,
  resolveProfileImage,
  assignSignupImage,
  DEFAULT_DICEBEAR_STYLE,
} from 'src/lib';

import {
  gravatarCustomOptions,
  gravatarEmailFixtures,
  urlNormalizationFixtures,
} from '../../fixtures';

function createConfigService(
  values: Record<string, string | undefined> = {},
): ConfigService {
  return {
    get: <T = string>(key: string): T | undefined =>
      values[key] as T | undefined,
  } as ConfigService;
}

describe('GravatarService', () => {
  let service: GravatarService;

  beforeEach(() => {
    service = new GravatarService(createConfigService());
  });

  it('returns an https gravatar URL with DiceBear loops fallback by default', () => {
    const url = service.getGravatarUrl(gravatarEmailFixtures.standard);

    expect(url.startsWith('https://')).toBe(true);
    expect(url).toContain('gravatar.com/avatar/');
    expect(url).toContain('s=200');
    expect(url).toContain('r=pg');
    expect(url).toContain(
      encodeURIComponent('api.dicebear.com/10.x/loops/png'),
    );
    expect(url).toContain(encodeURIComponent('tags=animation'));
  });

  it('uses DICEBEAR_STYLE from env when set', () => {
    service = new GravatarService(
      createConfigService({ DICEBEAR_STYLE: 'avataaars' }),
    );
    const url = service.getGravatarUrl(gravatarEmailFixtures.standard);

    expect(url).toContain(
      encodeURIComponent('api.dicebear.com/10.x/avataaars/png'),
    );
    expect(url).not.toContain(encodeURIComponent('tags=animation'));
  });

  it('applies custom classic default over DiceBear', () => {
    const url = service.getGravatarUrl(
      gravatarEmailFixtures.standard,
      gravatarCustomOptions,
    );

    expect(url).toContain('s=80');
    expect(url).toContain('r=g');
    expect(url).toContain('d=retro');
  });

  it('normalizes protocol-relative URLs to https', () => {
    const url = service.getGravatarUrl(gravatarEmailFixtures.protocolRelative);
    expect(url.startsWith('https://')).toBe(true);
    expect(url.startsWith('//')).toBe(false);
  });

  it('normalizes bare host URLs to https', () => {
    const url = service.getGravatarUrl(gravatarEmailFixtures.bareHost);
    expect(url.startsWith('https://www.gravatar.com')).toBe(true);
  });

  it.each(Object.entries(urlNormalizationFixtures))(
    'ensureHttpsUrl normalizes %s URLs',
    (_label, { input, expected }) => {
      expect(ensureHttpsUrl(input)).toBe(expected);
    },
  );
});

describe('DiceBear helpers', () => {
  it('resolveDicebearStyle defaults to loops', () => {
    expect(resolveDicebearStyle()).toBe(DEFAULT_DICEBEAR_STYLE);
    expect(resolveDicebearStyle('')).toBe(DEFAULT_DICEBEAR_STYLE);
    expect(resolveDicebearStyle('  ')).toBe(DEFAULT_DICEBEAR_STYLE);
  });

  it('resolveDicebearStyle prefers env when filled', () => {
    expect(resolveDicebearStyle('bottts')).toBe('bottts');
    expect(resolveDicebearStyle('  pixel-art  ')).toBe('pixel-art');
  });

  it('buildDicebearUrl includes animation tags for loops', () => {
    const url = buildDicebearUrl('user@example.com', 'loops', '200');
    expect(url).toBe(
      'https://api.dicebear.com/10.x/loops/png?seed=user%40example.com&size=200&tags=animation',
    );
  });

  it('buildDicebearUrl omits animation tags for other styles', () => {
    const url = buildDicebearUrl('user@example.com', 'avataaars', '80');
    expect(url).toBe(
      'https://api.dicebear.com/10.x/avataaars/png?seed=user%40example.com&size=80',
    );
  });
});

describe('signup profile image', () => {
  it('uses Gravatar with DiceBear as the missing-avatar fallback', () => {
    const url = resolveProfileImage(gravatarEmailFixtures.standard);

    expect(url.startsWith('https://')).toBe(true);
    expect(url).toContain('gravatar.com/avatar/');
    expect(url).toContain('s=200');
    expect(url).toContain('r=pg');
    expect(url).toContain(
      encodeURIComponent('api.dicebear.com/10.x/loops/png'),
    );
    expect(url).toContain(encodeURIComponent('tags=animation'));
  });

  it('keeps an existing image instead of overwriting it', () => {
    expect(
      assignSignupImage({
        email: gravatarEmailFixtures.standard,
        image: 'https://cdn.mail.test/avatars/jane.png',
      }),
    ).toBeNull();
  });

  it('assigns a Gravatar URL when a new user has no image', () => {
    expect(
      assignSignupImage({ email: gravatarEmailFixtures.standard, image: null }),
    ).toBe(resolveProfileImage(gravatarEmailFixtures.standard));
  });
});
