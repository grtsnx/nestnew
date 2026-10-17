import { handleResponse } from 'src/middleware';
import {
  applyAuthCookies,
  assertNotSelf,
  decodeOrganisationMetadata,
  parseAdminRole,
  parseOrgMemberRole,
  pickAdminUserUpdate,
} from 'src/modules/admin/admin.service';

describe('pickAdminUserUpdate', () => {
  it('returns only the fields the admin sent', () => {
    expect(
      pickAdminUserUpdate({
        name: ' Jane Doe ',
        image: 'https://cdn.mail.test/avatars/jane.png',
        role: 'support',
      }),
    ).toEqual({
      name: 'Jane Doe',
      image: 'https://cdn.mail.test/avatars/jane.png',
      role: 'support',
    });
  });

  it('includes username and telephone when provided', () => {
    expect(
      pickAdminUserUpdate({
        username: 'jane_doe',
        telephone: '+15551234567',
      }),
    ).toEqual({
      username: 'jane_doe',
      telephone: '+15551234567',
    });
  });

  it('returns null when nothing would change', () => {
    expect(pickAdminUserUpdate({})).toBeNull();
    expect(pickAdminUserUpdate({ name: '   ' })).toBeNull();
  });
});

describe('parseAdminRole', () => {
  it('accepts platform roles', () => {
    expect(parseAdminRole(' admin ')).toBe('admin');
    expect(parseAdminRole('finance_officer')).toBe('finance_officer');
  });

  it('rejects unknown roles', () => {
    expect(parseAdminRole('owner')).toBeNull();
    expect(parseAdminRole('')).toBeNull();
  });
});

describe('parseOrgMemberRole', () => {
  it('accepts organisation roles', () => {
    expect(parseOrgMemberRole(' owner ')).toBe('owner');
    expect(parseOrgMemberRole('admin')).toBe('admin');
    expect(parseOrgMemberRole('member')).toBe('member');
  });

  it('rejects platform roles', () => {
    expect(parseOrgMemberRole('support')).toBeNull();
    expect(parseOrgMemberRole('')).toBeNull();
  });
});

describe('assertNotSelf', () => {
  it('blocks acting on yourself', () => {
    expect(() =>
      assertNotSelf('user_1', 'user_1', 'Cannot delete yourself'),
    ).toThrow(handleResponse);
  });

  it('allows acting on another user', () => {
    expect(() =>
      assertNotSelf('user_1', 'user_2', 'Cannot delete yourself'),
    ).not.toThrow();
  });
});

describe('decodeOrganisationMetadata', () => {
  it('parses JSON metadata', () => {
    expect(decodeOrganisationMetadata('{"seats":25}')).toEqual({ seats: 25 });
  });

  it('returns null for empty values', () => {
    expect(decodeOrganisationMetadata(null)).toBeNull();
  });
});

describe('applyAuthCookies', () => {
  it('copies every set-cookie value onto the response', () => {
    const headers = new Headers();
    headers.append('set-cookie', 'better-auth.session_token=abc; Path=/');
    headers.append('set-cookie', 'better-auth.admin_session=xyz; Path=/');
    const append = jest.fn();

    applyAuthCookies({ append } as never, headers);

    expect(append).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenNthCalledWith(
      1,
      'Set-Cookie',
      'better-auth.session_token=abc; Path=/',
    );
    expect(append).toHaveBeenNthCalledWith(
      2,
      'Set-Cookie',
      'better-auth.admin_session=xyz; Path=/',
    );
  });

  it('splits a comma-joined set-cookie header', () => {
    const headers = {
      getSetCookie: () => [] as string[],
      get: (name: string) =>
        name.toLowerCase() === 'set-cookie'
          ? 'better-auth.session_token=abc; Path=/, better-auth.admin_session=xyz; Path=/'
          : null,
    };
    const append = jest.fn();

    applyAuthCookies({ append } as never, headers as unknown as Headers);

    expect(append).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenNthCalledWith(
      1,
      'Set-Cookie',
      expect.stringContaining('session_token=abc'),
    );
    expect(append).toHaveBeenNthCalledWith(
      2,
      'Set-Cookie',
      expect.stringContaining('admin_session=xyz'),
    );
  });
});
