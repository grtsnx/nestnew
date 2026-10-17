/**
 * Shared OpenAPI example values for Nest DTOs and Auth docs merge.
 * One coherent persona/org — docs-stable, not env-dependent.
 */
export const ApiSamples = {
  name: 'Jane Doe',
  displayUsername: 'jane_doe',
  staffName: 'Staff Member',
  email: 'jane@mail.test',
  staffEmail: 'staff@mail.test',
  memberEmail: 'member@mail.test',
  username: 'jane_doe',
  telephone: '+15551234567',
  password: 'Password123!',
  newPassword: 'Password123!',
  currentPassword: 'Password123!',
  totp: '123456',
  otp: '123456',
  issuer: 'Acme',
  oauthProvider: 'google' as const,
  callbackUrl: 'http://localhost:3000',
  imageUrl: 'https://cdn.mail.test/avatars/jane.png',
  rememberMe: true,
  revokeOtherSessions: true,
  resetToken: 'reset_tok_acme01jane0doe00000001',
  sessionToken: 'sess_tok_acme01jane0doe00000001',
  emailVerificationType: 'email-verification',
  revokeSessionsMode: 'others' as const,
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
  forgetPasswordMessage:
    'If this email exists in our system, check your email for the reset link',

  userId: 'o9q385ukff397w2ai8ohjpzg',
  organisationId: 'org_acme01inc000000000000001',
  auditEventType: 'user_signed_in',
  orgId: 'org_acme01inc000000000000001',
  orgName: 'Acme Inc',
  orgSlug: 'acme-inc',
  orgLogo: 'https://cdn.mail.test/acme/logo.png',
  orgMetadata: { industry: 'software', seats: 25 } as Record<string, unknown>,
  keepCurrentActiveOrganization: true,

  teamId: 'team_acme01eng00000000000001',
  teamName: 'Engineering',

  memberRole: 'member',
  memberRoleAdmin: 'admin',
  staffRole: 'support',
  resendInvite: true,

  roleName: 'ops',
  roleDescription: 'Operations read and write',
  roleStatements: { user: ['read'], session: ['revoke'] } as Record<
    string,
    string[]
  >,
  roleActive: true,

  planName: 'Pro',
  planSlug: 'pro',
  planDescription: 'Best for growing teams',
  planAudience: 'individual',
  planAudienceOrg: 'organization',
  planBillingType: 'credits',
  autumnProductId: 'pro_credits',
  planLimits: { ai_tokens: 10000 } as Record<string, number>,
  planLimitsUpdated: { ai_tokens: 20000 } as Record<string, number>,
  trialDays: 14,
  trialDaysShort: 7,
  planActive: true,
  planSortOrder: 10,
  planSortOrderUpdated: 20,

  featureId: 'ai_tokens',
  requiredBalance: 1,
  usageValue: 1,

  listLimit: 50,
  listOffset: 0,
  searchValue: 'jane',
  searchField: 'email',
  sortBy: 'createdAt',
  sortDirection: 'desc' as const,
  multiSessionEnabled: true,
  signupCreditsAmount: 150,
  rewardCreditsAmount: 25,
  creditAudience: 'user',
  creditReason: 'promo',
} as const;

/** User object as returned by Auth signup/signin/change (live-tested shape). */
export const ApiSampleUser = {
  name: ApiSamples.name,
  email: ApiSamples.email,
  emailVerified: false,
  image: ApiSamples.imageUrl,
  createdAt: ApiSamples.createdAt,
  updatedAt: ApiSamples.updatedAt,
  username: ApiSamples.username,
  displayUsername: ApiSamples.displayUsername,
  twoFactorEnabled: false,
  lastLoginMethod: 'email',
  role: 'user',
  banned: false,
  banReason: null,
  banExpires: null,
  telephone: ApiSamples.telephone,
  id: ApiSamples.userId,
} as const;

export const ApiSampleUserVerified = {
  ...ApiSampleUser,
  emailVerified: true,
} as const;

/**
 * Full request-body examples for public Auth paths (Swagger Example Value tab).
 */
export const AUTH_REQUEST_BODY_EXAMPLES: Readonly<
  Record<string, Record<string, unknown>>
> = {
  '/signup/email': {
    name: ApiSamples.name,
    email: ApiSamples.email,
    password: ApiSamples.password,
    image: ApiSamples.imageUrl,
    callbackURL: ApiSamples.callbackUrl,
    rememberMe: ApiSamples.rememberMe,
    telephone: ApiSamples.telephone,
    username: ApiSamples.username,
    displayUsername: ApiSamples.displayUsername,
  },
  '/signin/email': {
    email: ApiSamples.email,
    password: ApiSamples.password,
    rememberMe: ApiSamples.rememberMe,
    callbackURL: ApiSamples.callbackUrl,
  },
  '/signin/social': {
    provider: ApiSamples.oauthProvider,
    callbackURL: ApiSamples.callbackUrl,
    disableRedirect: true,
  },
  '/send/verification/email': {
    email: ApiSamples.email,
    type: ApiSamples.emailVerificationType,
  },
  '/verify/email': {
    email: ApiSamples.email,
    otp: ApiSamples.otp,
  },
  '/forget/password': {
    email: ApiSamples.email,
    redirectTo: ApiSamples.callbackUrl,
  },
  '/reset/password': {
    newPassword: ApiSamples.newPassword,
    token: ApiSamples.resetToken,
  },
};

const authOk = (
  data: unknown,
  message = 'Request succeeded',
): Record<string, unknown> => ({
  statusCode: 200,
  statusType: 'OK',
  message,
  data,
});

/**
 * 200 response examples — handleResponse envelope over live Auth payloads.
 */
export const AUTH_RESPONSE_EXAMPLES: Readonly<
  Record<string, Record<string, unknown>>
> = {
  '/signup/email': authOk(
    { token: null, user: ApiSampleUser },
    'Account created',
  ),
  '/signin/email': authOk(
    {
      redirect: true,
      token: ApiSamples.sessionToken,
      url: ApiSamples.callbackUrl,
      user: ApiSampleUserVerified,
    },
    'Login successful',
  ),
  '/signin/social': authOk(
    {
      token: ApiSamples.sessionToken,
      user: ApiSampleUserVerified,
      url: ApiSamples.callbackUrl,
      redirect: false,
    },
    'Login successful',
  ),
  '/send/verification/email': authOk({ success: true }, 'OTP sent'),
  '/verify/email': authOk(
    {
      status: true,
      token: null,
      user: ApiSampleUserVerified,
    },
    'Email verified',
  ),
  '/forget/password': authOk(
    {
      status: true,
      message: ApiSamples.forgetPasswordMessage,
    },
    'Reset link sent',
  ),
  '/reset/password': authOk({ status: true }, 'Password reset successful'),
};

const nestOk = (message: string, data?: unknown): Record<string, unknown> => ({
  statusCode: 200,
  statusType: 'OK',
  message,
  ...(data !== undefined ? { data } : {}),
});

/** Session user as returned by GET /v1/user/me (live-tested). */
export const ApiSampleSessionUser = {
  ...ApiSampleUserVerified,
  role: 'admin',
} as const;

/**
 * Nest handleResponse envelopes — shaped from live calls where noted.
 * Keys: `METHOD /openapi/path` (path params use OpenAPI names).
 */
export const NEST_RESPONSE_EXAMPLES: Readonly<
  Record<string, Record<string, unknown>>
> = {
  'GET /': nestOk('Hello World', {
    message: 'Hello World!',
  }),
  'GET /health': nestOk('Server is up', { status: 'up' }),
  'GET /health/ready': nestOk('Services ready', {
    redis: { status: 'up' },
    queue: { status: 'up' },
  }),

  'GET /v1/user/me': nestOk('Profile loaded', {
    user: ApiSampleSessionUser,
  }),
  'PATCH /v1/user/profile': nestOk('Profile updated', {
    status: true,
    user: {
      ...ApiSampleSessionUser,
      name: ApiSamples.name,
      image: ApiSamples.imageUrl,
      username: ApiSamples.username,
      telephone: ApiSamples.telephone,
    },
  }),
  'DELETE /v1/user': nestOk('Account deleted', {
    success: true,
    message: 'User deleted',
  }),
  'GET /v1/user/overview': nestOk('Overview loaded', {
    user: ApiSampleSessionUser,
    session: {
      expiresAt: '2026-01-22T12:00:00.000Z',
      token: ApiSamples.sessionToken,
      createdAt: ApiSamples.createdAt,
      updatedAt: ApiSamples.updatedAt,
      ipAddress: '127.0.0.1',
      browser: 'Opera',
      browserVersion: '133.0.0.0',
      platform: 'macOS',
      platformVersion: '10.15.7',
      architecture: 'Intel',
      device: 'desktop',
      deviceName: 'Mac',
      userAgent: 'Opera 133 on macOS Catalina',
      current: true,
      userId: ApiSamples.userId,
      activeOrganizationId: ApiSamples.orgId,
      activeTeamId: null,
      impersonatedBy: null,
      id: ApiSamples.userId,
    },
    organizations: [
      {
        id: ApiSamples.orgId,
        name: ApiSamples.orgName,
        slug: ApiSamples.orgSlug,
        logo: ApiSamples.orgLogo,
        creditBalance: 0,
        role: 'owner',
      },
    ],
    teams: [],
    billing: {
      audience: 'individual',
      credits: { balance: 100, granted: 100 },
    },
  }),
  'PATCH /v1/user/onboarding': nestOk('Onboarding updated', {
    status: true,
  }),
  'PATCH /v1/user/password': nestOk('Password updated', {
    token: ApiSamples.sessionToken,
    user: ApiSampleUserVerified,
  }),
  'GET /v1/user/check/username': nestOk('Username checked', {
    available: true,
  }),
  'GET /v1/user/check/telephone': nestOk('Telephone checked', {
    available: true,
  }),
  'GET /v1/user/accounts': nestOk('Accounts loaded', [
    {
      accountId: 'acc_acme01cred0000000000001',
      providerId: 'credential',
      userId: ApiSamples.userId,
      createdAt: ApiSamples.createdAt,
      updatedAt: ApiSamples.updatedAt,
      id: ApiSamples.userId,
      scopes: [],
    },
  ]),
  'GET /v1/user/sessions': nestOk('Sessions loaded', [
    {
      expiresAt: '2026-01-22T12:00:00.000Z',
      token: ApiSamples.sessionToken,
      createdAt: ApiSamples.createdAt,
      updatedAt: ApiSamples.updatedAt,
      ipAddress: '127.0.0.1',
      browser: 'Opera',
      browserVersion: '133.0.0.0',
      platform: 'macOS',
      platformVersion: '10.15.7',
      architecture: 'Intel',
      device: 'desktop',
      deviceName: 'Mac',
      userAgent: 'Opera 133 on macOS Catalina',
      current: true,
      userId: ApiSamples.userId,
      activeOrganizationId: null,
      activeTeamId: null,
      impersonatedBy: null,
      id: ApiSamples.userId,
    },
  ]),
  'DELETE /v1/user/sessions': nestOk('Other sessions ended', {
    status: true,
  }),
  'DELETE /v1/user/sessions/{id}': nestOk('Session ended', {
    status: true,
  }),
  'POST /v1/user/sign/out': nestOk('Signed out'),
  'POST /v1/user/2fa/enable': nestOk('Two-factor enabled', {
    totpURI: `otpauth://totp/${ApiSamples.issuer}:${ApiSamples.email}?secret=JBSWY3DPEHPK3PXP&issuer=${ApiSamples.issuer}`,
    backupCodes: ['a1b2c3d4', 'e5f6g7h8'],
  }),
  'POST /v1/user/2fa/disable': nestOk('Two-factor disabled', {
    status: true,
  }),
  'POST /v1/user/2fa/verify': nestOk('Two-factor verified', {
    status: true,
  }),
  'POST /v1/user/accounts/link': nestOk('Link started', {
    url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=…',
    redirect: true,
  }),
  'DELETE /v1/user/accounts/{provider}': nestOk('Account unlinked', {
    status: true,
  }),

  'POST /v1/organisation': nestOk('Organisation created', {
    name: ApiSamples.orgName,
    slug: ApiSamples.orgSlug,
    logo: ApiSamples.orgLogo,
    createdAt: ApiSamples.createdAt,
    id: ApiSamples.orgId,
    members: [
      {
        organizationId: ApiSamples.orgId,
        userId: ApiSamples.userId,
        role: 'owner',
        createdAt: ApiSamples.createdAt,
        id: ApiSamples.userId,
      },
    ],
  }),
  'GET /v1/organisation': nestOk('Organisations loaded', [
    {
      name: ApiSamples.orgName,
      slug: ApiSamples.orgSlug,
      logo: ApiSamples.orgLogo,
      createdAt: ApiSamples.createdAt,
      metadata: null,
      id: ApiSamples.orgId,
    },
  ]),
  'POST /v1/organisation/active': nestOk('Active organisation updated', {
    name: ApiSamples.orgName,
    slug: ApiSamples.orgSlug,
    logo: ApiSamples.orgLogo,
    createdAt: ApiSamples.createdAt,
    metadata: null,
    id: ApiSamples.orgId,
  }),
  'PATCH /v1/organisation/{id}': nestOk('Organisation updated', {
    name: ApiSamples.orgName,
    slug: ApiSamples.orgSlug,
    logo: ApiSamples.orgLogo,
    createdAt: ApiSamples.createdAt,
    metadata: ApiSamples.orgMetadata,
    id: ApiSamples.orgId,
  }),
  'DELETE /v1/organisation/{id}': nestOk('Organisation deleted', {
    status: true,
  }),
  'GET /v1/organisation/member': nestOk('Members loaded', {
    members: [
      {
        organizationId: ApiSamples.orgId,
        userId: ApiSamples.userId,
        role: 'owner',
        createdAt: ApiSamples.createdAt,
        id: ApiSamples.userId,
        user: {
          id: ApiSamples.userId,
          name: ApiSamples.name,
          email: ApiSamples.email,
          image: ApiSamples.imageUrl,
        },
      },
    ],
    total: 1,
  }),
  'POST /v1/organisation/member/invite': nestOk('Invitation sent', {
    organizationId: ApiSamples.orgId,
    email: ApiSamples.memberEmail,
    role: ApiSamples.memberRole,
    teamId: null,
    status: 'pending',
    expiresAt: '2026-01-17T12:00:00.000Z',
    createdAt: ApiSamples.createdAt,
    inviterId: ApiSamples.userId,
    id: ApiSamples.userId,
  }),
  'PATCH /v1/organisation/member/{memberId}/role': nestOk(
    'Member role updated',
    { status: true },
  ),
  'DELETE /v1/organisation/member/{memberId}': nestOk('Member removed', {
    status: true,
  }),
  'POST /v1/organisation/team': nestOk('Team created', {
    name: ApiSamples.teamName,
    organizationId: ApiSamples.orgId,
    createdAt: ApiSamples.createdAt,
    updatedAt: ApiSamples.updatedAt,
    id: ApiSamples.teamId,
  }),
  'GET /v1/organisation/team': nestOk('Teams loaded', [
    {
      name: ApiSamples.teamName,
      organizationId: ApiSamples.orgId,
      createdAt: ApiSamples.createdAt,
      updatedAt: ApiSamples.updatedAt,
      id: ApiSamples.teamId,
    },
  ]),
  'POST /v1/organisation/team/{teamId}/members': nestOk('Team member added', {
    teamId: ApiSamples.teamId,
    userId: ApiSamples.userId,
    createdAt: ApiSamples.createdAt,
    id: ApiSamples.userId,
  }),
  'DELETE /v1/organisation/team/members': nestOk('Team member removed', {
    status: true,
  }),
  'PATCH /v1/organisation/team/{teamId}': nestOk('Team updated', {
    name: ApiSamples.teamName,
    organizationId: ApiSamples.orgId,
    createdAt: ApiSamples.createdAt,
    updatedAt: ApiSamples.updatedAt,
    id: ApiSamples.teamId,
  }),
  'DELETE /v1/organisation/team/{teamId}': nestOk('Team deleted', {
    message: 'Team deleted successfully.',
  }),

  'GET /v1/admin/users': nestOk('Users loaded', {
    users: [ApiSampleSessionUser],
    total: 1,
    limit: ApiSamples.listLimit,
  }),
  'GET /v1/admin/users/{id}': nestOk('User loaded', ApiSampleSessionUser),
  'PATCH /v1/admin/users/{id}': nestOk('User updated', {
    ...ApiSampleSessionUser,
    name: ApiSamples.name,
    username: ApiSamples.username,
    telephone: ApiSamples.telephone,
  }),
  'DELETE /v1/admin/users/{id}': nestOk('User deleted', { success: true }),
  'POST /v1/admin/users/{id}/ban': nestOk('User banned', {
    user: { ...ApiSampleSessionUser, banned: true, banReason: 'Spamming' },
  }),
  'POST /v1/admin/users/{id}/unban': nestOk('User unbanned', {
    user: { ...ApiSampleSessionUser, banned: false, banReason: null },
  }),
  'GET /v1/admin/users/{id}/sessions': nestOk('Sessions loaded', {
    sessions: [
      {
        id: ApiSamples.userId,
        token: ApiSamples.sessionToken,
        userId: ApiSamples.userId,
        impersonatedBy: null,
      },
    ],
  }),
  'DELETE /v1/admin/users/{id}/sessions': nestOk('Sessions revoked', {
    success: true,
  }),
  'DELETE /v1/admin/users/{id}/sessions/{sessionId}': nestOk('Session ended', {
    success: true,
  }),
  'PATCH /v1/admin/users/{id}/password': nestOk('Password updated', {
    status: true,
  }),
  'POST /v1/admin/users/{id}/impersonate': nestOk('Impersonation started', {
    session: {
      token: ApiSamples.sessionToken,
      userId: ApiSamples.userId,
      impersonatedBy: ApiSamples.userId,
    },
    user: ApiSampleUserVerified,
  }),
  'POST /v1/admin/impersonate/stop': nestOk('Impersonation stopped', {
    session: {
      token: ApiSamples.sessionToken,
      userId: ApiSamples.userId,
      impersonatedBy: null,
    },
    user: ApiSampleSessionUser,
  }),
  'POST /v1/admin/organisations': nestOk('Organisation created', {
    id: ApiSamples.orgId,
    name: ApiSamples.orgName,
    slug: ApiSamples.orgSlug,
    logo: ApiSamples.orgLogo,
    metadata: ApiSamples.orgMetadata,
    creditBalance: 0,
    createdAt: ApiSamples.createdAt,
  }),
  'GET /v1/admin/organisations': nestOk('Organisations loaded', {
    organisations: [
      {
        id: ApiSamples.orgId,
        name: ApiSamples.orgName,
        slug: ApiSamples.orgSlug,
        logo: ApiSamples.orgLogo,
        metadata: ApiSamples.orgMetadata,
        creditBalance: 0,
        createdAt: ApiSamples.createdAt,
      },
    ],
    total: 1,
    limit: ApiSamples.listLimit,
    offset: ApiSamples.listOffset,
  }),
  'GET /v1/admin/organisations/{id}': nestOk('Organisation loaded', {
    id: ApiSamples.orgId,
    name: ApiSamples.orgName,
    slug: ApiSamples.orgSlug,
    logo: ApiSamples.orgLogo,
    metadata: ApiSamples.orgMetadata,
    creditBalance: 0,
    createdAt: ApiSamples.createdAt,
    members: [],
    teams: [],
    invitations: [],
  }),
  'PATCH /v1/admin/organisations/{id}': nestOk('Organisation updated', {
    id: ApiSamples.orgId,
    name: ApiSamples.orgName,
    slug: ApiSamples.orgSlug,
    logo: ApiSamples.orgLogo,
    metadata: ApiSamples.orgMetadata,
    creditBalance: 0,
    createdAt: ApiSamples.createdAt,
  }),
  'DELETE /v1/admin/organisations/{id}': nestOk('Organisation deleted', {
    id: ApiSamples.orgId,
  }),
  'GET /v1/admin/organisations/{id}/members': nestOk('Members loaded', [
    {
      id: ApiSamples.userId,
      organizationId: ApiSamples.orgId,
      userId: ApiSamples.userId,
      role: ApiSamples.memberRole,
    },
  ]),
  'POST /v1/admin/organisations/{id}/members': nestOk('Member added', {
    id: ApiSamples.userId,
    organizationId: ApiSamples.orgId,
    userId: ApiSamples.userId,
    role: ApiSamples.memberRole,
  }),
  'PATCH /v1/admin/organisations/{id}/members/{memberId}': nestOk(
    'Member role updated',
    {
      id: ApiSamples.userId,
      organizationId: ApiSamples.orgId,
      userId: ApiSamples.userId,
      role: ApiSamples.memberRoleAdmin,
    },
  ),
  'DELETE /v1/admin/organisations/{id}/members/{memberId}': nestOk(
    'Member removed',
    { id: ApiSamples.userId },
  ),
  'GET /v1/admin/organisations/{id}/invitations': nestOk('Invitations loaded', [
    {
      id: ApiSamples.userId,
      organizationId: ApiSamples.orgId,
      email: ApiSamples.memberEmail,
      role: ApiSamples.memberRole,
      status: 'pending',
    },
  ]),
  'POST /v1/admin/organisations/{id}/invitations': nestOk('Invitation sent', {
    id: ApiSamples.userId,
    organizationId: ApiSamples.orgId,
    email: ApiSamples.memberEmail,
    role: ApiSamples.memberRole,
    status: 'pending',
  }),
  'DELETE /v1/admin/organisations/{id}/invitations/{invitationId}': nestOk(
    'Invitation canceled',
    { id: ApiSamples.userId, status: 'canceled' },
  ),
  'POST /v1/admin/teams': nestOk('Team created', {
    id: ApiSamples.teamId,
    name: ApiSamples.teamName,
    organizationId: ApiSamples.orgId,
    creditBalance: 0,
    createdAt: ApiSamples.createdAt,
  }),
  'GET /v1/admin/teams': nestOk('Teams loaded', {
    teams: [
      {
        id: ApiSamples.teamId,
        name: ApiSamples.teamName,
        organizationId: ApiSamples.orgId,
        creditBalance: 0,
        createdAt: ApiSamples.createdAt,
      },
    ],
    total: 1,
    limit: ApiSamples.listLimit,
    offset: ApiSamples.listOffset,
  }),
  'GET /v1/admin/teams/{id}': nestOk('Team loaded', {
    id: ApiSamples.teamId,
    name: ApiSamples.teamName,
    organizationId: ApiSamples.orgId,
    creditBalance: 0,
    createdAt: ApiSamples.createdAt,
    teammembers: [],
  }),
  'PATCH /v1/admin/teams/{id}': nestOk('Team updated', {
    id: ApiSamples.teamId,
    name: ApiSamples.teamName,
    organizationId: ApiSamples.orgId,
    creditBalance: 0,
    createdAt: ApiSamples.createdAt,
  }),
  'DELETE /v1/admin/teams/{id}': nestOk('Team deleted', {
    id: ApiSamples.teamId,
  }),
  'GET /v1/admin/teams/{id}/members': nestOk('Team members loaded', [
    {
      id: ApiSamples.userId,
      teamId: ApiSamples.teamId,
      userId: ApiSamples.userId,
    },
  ]),
  'POST /v1/admin/teams/{id}/members': nestOk('Team member added', {
    id: ApiSamples.userId,
    teamId: ApiSamples.teamId,
    userId: ApiSamples.userId,
  }),
  'DELETE /v1/admin/teams/{id}/members/{userId}': nestOk(
    'Team member removed',
    {
      id: ApiSamples.userId,
    },
  ),
  'GET /v1/admin/roles': nestOk('Roles loaded', [
    {
      id: ApiSamples.userId,
      name: 'admin',
      description: 'Full platform administration',
      statements: {
        plan: ['create', 'read'],
        role: ['create', 'read'],
        user: ['create', 'list'],
        session: ['list', 'revoke'],
        support: ['ticket', 'user:read'],
        settings: ['read', 'write'],
      },
      isSystem: true,
      active: true,
      createdAt: ApiSamples.createdAt,
      updatedAt: ApiSamples.updatedAt,
    },
  ]),
  'POST /v1/admin/roles': nestOk('Role created', {
    id: ApiSamples.userId,
    name: ApiSamples.roleName,
    description: ApiSamples.roleDescription,
    statements: ApiSamples.roleStatements,
    isSystem: false,
    active: true,
    createdAt: ApiSamples.createdAt,
    updatedAt: ApiSamples.updatedAt,
  }),
  'PATCH /v1/admin/roles/{id}': nestOk('Role updated', {
    id: ApiSamples.userId,
    name: ApiSamples.roleName,
    description: ApiSamples.roleDescription,
    statements: ApiSamples.roleStatements,
    isSystem: false,
    active: true,
    createdAt: ApiSamples.createdAt,
    updatedAt: ApiSamples.updatedAt,
  }),
  'PATCH /v1/admin/roles/{id}/permissions': nestOk('Role permissions updated', {
    id: ApiSamples.userId,
    name: ApiSamples.roleName,
    description: ApiSamples.roleDescription,
    statements: ApiSamples.roleStatements,
    isSystem: false,
    active: true,
    createdAt: ApiSamples.createdAt,
    updatedAt: ApiSamples.updatedAt,
  }),
  'GET /v1/admin/plans': nestOk('Plans loaded', [
    {
      id: ApiSamples.userId,
      name: ApiSamples.planName,
      slug: ApiSamples.planSlug,
      description: ApiSamples.planDescription,
      audience: ApiSamples.planAudience,
      billingType: ApiSamples.planBillingType,
      autumnProductId: ApiSamples.autumnProductId,
      limits: ApiSamples.planLimits,
      trialDays: ApiSamples.trialDays,
      active: true,
      sortOrder: ApiSamples.planSortOrder,
      createdAt: ApiSamples.createdAt,
      updatedAt: ApiSamples.updatedAt,
    },
  ]),
  'POST /v1/admin/plans': nestOk('Plan created', {
    id: ApiSamples.userId,
    name: ApiSamples.planName,
    slug: ApiSamples.planSlug,
    description: ApiSamples.planDescription,
    audience: ApiSamples.planAudience,
    billingType: ApiSamples.planBillingType,
    autumnProductId: ApiSamples.autumnProductId,
    limits: ApiSamples.planLimits,
    trialDays: ApiSamples.trialDays,
    active: true,
    sortOrder: ApiSamples.planSortOrder,
    createdAt: ApiSamples.createdAt,
    updatedAt: ApiSamples.updatedAt,
  }),
  'PATCH /v1/admin/plans/{id}': nestOk('Plan updated', {
    id: ApiSamples.userId,
    name: ApiSamples.planName,
    slug: ApiSamples.planSlug,
    description: ApiSamples.planDescription,
    audience: ApiSamples.planAudienceOrg,
    billingType: ApiSamples.planBillingType,
    autumnProductId: ApiSamples.autumnProductId,
    limits: ApiSamples.planLimitsUpdated,
    trialDays: ApiSamples.trialDaysShort,
    active: true,
    sortOrder: ApiSamples.planSortOrderUpdated,
    createdAt: ApiSamples.createdAt,
    updatedAt: ApiSamples.updatedAt,
  }),
  'POST /v1/admin/staff/invite': nestOk('Staff user created', {
    user: {
      ...ApiSampleUserVerified,
      name: ApiSamples.staffName,
      email: ApiSamples.staffEmail,
      role: ApiSamples.staffRole,
    },
  }),
  'PATCH /v1/admin/settings/multi-session': nestOk(
    'Multi-session setting updated',
    { multiSessionEnabled: ApiSamples.multiSessionEnabled },
  ),
  'GET /v1/admin/settings/credits': nestOk('Credits setting loaded', {
    amount: ApiSamples.signupCreditsAmount,
  }),
  'PATCH /v1/admin/settings/credits': nestOk('Credits setting updated', {
    amount: ApiSamples.signupCreditsAmount,
  }),
  'POST /v1/admin/credits/reward': nestOk('Credits rewarded', {
    audience: ApiSamples.creditAudience,
    targetId: ApiSamples.userId,
    amount: ApiSamples.rewardCreditsAmount,
    balance: 125,
  }),
  'GET /v1/admin/audit-logs': nestOk('Audit logs loaded', {
    events: [
      {
        id: 'evt_acme01signin000000000001',
        eventType: 'user_signed_in',
        eventKey: ApiSamples.userId,
        createdAt: ApiSamples.createdAt,
        eventData: {
          userId: ApiSamples.userId,
          identifier: ApiSamples.email,
        },
      },
    ],
    total: 1,
    limit: ApiSamples.listLimit,
    offset: ApiSamples.listOffset,
  }),

  'POST /v1/billing/customer': nestOk('Customer ready', {
    id: ApiSamples.userId,
    email: ApiSamples.email,
    name: ApiSamples.name,
  }),
  'POST /v1/billing/check': nestOk('Access checked', {
    allowed: true,
    balance: 100,
  }),
  'POST /v1/billing/attach': nestOk('Plan attached', {
    status: true,
  }),
  'POST /v1/billing/track': nestOk('Usage recorded', {
    status: true,
  }),
  'GET /v1/billing/balance': nestOk('Balance loaded', {
    features: {
      [ApiSamples.featureId]: { balance: 1000, usage: 0 },
    },
  }),
};
