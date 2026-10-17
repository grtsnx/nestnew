import { GravatarService, ensureHttpsUrl } from 'src/lib';

import {
  gravatarCustomOptions,
  gravatarEmailFixtures,
  urlNormalizationFixtures,
} from '../../fixtures';

describe('GravatarService', () => {
  let service: GravatarService;

  beforeEach(() => {
    service = new GravatarService();
  });

  it('returns an https gravatar URL with defaults', () => {
    const url = service.getGravatarUrl(gravatarEmailFixtures.standard);

    expect(url.startsWith('https://')).toBe(true);
    expect(url).toContain('gravatar.com/avatar/');
    expect(url).toContain('s=200');
    expect(url).toContain('r=pg');
    expect(url).toContain('d=identicon');
  });

  it('applies custom options', () => {
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
