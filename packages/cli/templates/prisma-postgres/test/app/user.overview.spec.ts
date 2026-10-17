import { DEFAULT_SIGNUP_CREDITS } from 'src/lib';
import { buildUserOverview } from 'src/modules/user/user.service';

describe('buildUserOverview', () => {
  it('returns session, organisations, teams, and credits once', () => {
    const overview = buildUserOverview({
      user: {
        id: 'user_1',
        name: 'Jane Doe',
        email: 'jane@mail.test',
        creditBalance: DEFAULT_SIGNUP_CREDITS,
      },
      session: {
        id: 'sess_1',
        token: 'tok_1',
        expiresAt: new Date('2026-08-25T00:00:00.000Z'),
        createdAt: new Date('2026-08-18T00:00:00.000Z'),
        updatedAt: new Date('2026-08-18T00:00:00.000Z'),
        ipAddress: '127.0.0.1',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 OPR/133.0.0.0',
        userId: 'user_1',
        activeOrganizationId: 'org_1',
        activeTeamId: 'team_1',
        impersonatedBy: null,
      },
      memberships: [
        {
          id: 'mem_1',
          role: 'owner',
          organization: {
            id: 'org_1',
            name: 'Acme',
            slug: 'acme',
            logo: null,
            creditBalance: 40,
          },
        },
      ],
      teamMemberships: [
        {
          id: 'tm_1',
          team: {
            id: 'team_1',
            name: 'Design',
            organizationId: 'org_1',
            creditBalance: 15,
          },
        },
      ],
      grantedCredits: 150,
    });

    expect(overview.session).toMatchObject({
      id: 'sess_1',
      current: true,
      browser: 'Opera',
      userAgent: 'Opera 133 on macOS Catalina',
    });
    expect(overview.user).toEqual({
      id: 'user_1',
      name: 'Jane Doe',
      email: 'jane@mail.test',
    });
    expect(overview).not.toHaveProperty('organization');
    expect(overview).not.toHaveProperty('membership');
    expect(overview.organizations).toEqual([
      {
        id: 'org_1',
        name: 'Acme',
        slug: 'acme',
        logo: null,
        creditBalance: 40,
        role: 'owner',
      },
    ]);
    expect(overview.teams).toEqual([
      {
        id: 'team_1',
        name: 'Design',
        organizationId: 'org_1',
        creditBalance: 15,
      },
    ]);
    expect(overview.billing).toEqual({
      audience: 'individual',
      credits: {
        balance: DEFAULT_SIGNUP_CREDITS,
        granted: 150,
      },
    });
  });

  it('omits empty membership copies when the user has no orgs or teams', () => {
    const overview = buildUserOverview({
      user: { id: 'user_2', creditBalance: 100 },
      session: {
        id: 'sess_2',
        token: 'tok_2',
        userId: 'user_2',
        activeOrganizationId: null,
        activeTeamId: null,
      },
      memberships: [],
      teamMemberships: [],
    });

    expect(overview.user).toEqual({ id: 'user_2' });
    expect(overview).not.toHaveProperty('organization');
    expect(overview).not.toHaveProperty('membership');
    expect(overview.organizations).toEqual([]);
    expect(overview.teams).toEqual([]);
    expect(overview.billing).toEqual({
      audience: 'individual',
      credits: {
        balance: 100,
        granted: DEFAULT_SIGNUP_CREDITS,
      },
    });
  });
});
