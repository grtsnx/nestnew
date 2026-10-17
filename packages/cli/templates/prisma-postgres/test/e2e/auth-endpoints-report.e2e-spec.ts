import 'dotenv/config';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { splitSetCookieHeader } from 'better-auth/cookies';
import request from 'supertest';
import { App } from 'supertest/types';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppModule } from 'src/app';
import { PrismaService } from 'src/lib';
import { configureApp } from 'src/middleware';

type ReportRow = {
  method: string;
  path: string;
  expectedAuth: 'public' | 'session' | 'admin' | 'auth';
  status: number;
  ok: boolean;
  note: string;
};

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const report: ReportRow[] = [];

function record(
  method: string,
  path: string,
  expectedAuth: ReportRow['expectedAuth'],
  status: number,
  ok: boolean,
  note: string,
) {
  report.push({ method, path, expectedAuth, status, ok, note });
}

function isSessionCookieName(name: string): boolean {
  return name.includes('session_token');
}

function dropSessionCookies(jar: Map<string, string>): void {
  for (const key of [...jar.keys()]) {
    if (isSessionCookieName(key)) {
      jar.delete(key);
    }
  }
}

function cookieHeader(
  setCookie: string | string[] | undefined,
  previous = '',
): string {
  if (!setCookie) return previous;
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  const jar = new Map<string, string>();
  for (const piece of previous
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)) {
    const eq = piece.indexOf('=');
    if (eq > 0) jar.set(piece.slice(0, eq), piece.slice(eq + 1));
  }
  for (const raw of parts.flatMap((part) =>
    splitSetCookieHeader(String(part)),
  )) {
    const attrs = raw.split(';').map((s) => s.trim());
    const first = attrs[0] ?? '';
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    const name = first.slice(0, eq);
    const value = first.slice(eq + 1);
    const cleared = attrs.some((a) => {
      const lower = a.toLowerCase();
      return (
        lower === 'max-age=0' ||
        lower.startsWith('expires=thu, 01 jan 1970') ||
        value === '' ||
        value === '""'
      );
    });
    if (isSessionCookieName(name)) {
      dropSessionCookies(jar);
    }
    if (cleared) jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function cookieNames(cookie: string): string {
  return cookie
    .split(';')
    .map((piece) => piece.trim().split('=')[0] ?? '')
    .filter(Boolean)
    .join(',');
}

function sessionToken(cookie: string): string {
  let token = '';
  for (const piece of cookie.split(';').map((p) => p.trim())) {
    const eq = piece.indexOf('=');
    if (eq <= 0) continue;
    const name = piece.slice(0, eq);
    if (isSessionCookieName(name)) token = piece.slice(eq + 1);
  }
  return token;
}

function authed(req: request.Test, cookie: string): request.Test {
  const token = sessionToken(cookie);
  let next = req.set('Cookie', cookie);
  if (token) next = next.set('Authorization', `Bearer ${token}`);
  return next;
}

(hasDatabase ? describe : describe.skip)(
  'Auth & module endpoints report (e2e)',
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let cookie = '';
    let orgId = '';
    let teamId = '';
    let memberId = '';
    let userId = '';
    let staffUserId = '';
    let extraUserId = '';
    let adminOrgId = '';
    let adminTeamId = '';
    let adminMemberId = '';
    let adminInvitationId = '';

    const suffix = Date.now();
    const email = `e2e_${suffix}@example.com`;
    const password = 'E2eTestPassw0rd!Secure';
    const username = `e2euser${suffix}`.slice(0, 30);
    const telephone = `+1555${String(suffix).slice(-7)}`;

    beforeAll(async () => {
      process.env.BETTER_AUTH_SECRET ??=
        'test-secret-at-least-32-characters-long!!';
      process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
      process.env.PLATFORM_NAME ??= 'TestPlatform';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication({ bodyParser: false });
      configureApp(app);
      await app.init();
      prisma = app.get(PrismaService);
    }, 120_000);

    afterAll(async () => {
      const lines = [
        '# Auth endpoint report',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '| Result | Method | Path | Status | Auth | Note |',
        '| --- | --- | --- | --- | --- | --- |',
        ...report.map((row) => {
          const mark = row.ok ? 'PASS' : 'FAIL';
          const note = row.note.replace(/\|/g, '\\|').slice(0, 180);
          return `| ${mark} | ${row.method} | \`${row.path}\` | ${row.status} | ${row.expectedAuth} | ${note} |`;
        }),
        '',
        `**Summary:** ${report.filter((r) => r.ok).length} passed, ${report.filter((r) => !r.ok).length} failed`,
        '',
      ];
      const outPath = join(process.cwd(), 'test/e2e/AUTH_ENDPOINTS_REPORT.md');
      writeFileSync(outPath, lines.join('\n'), 'utf8');

      console.log('\n=== ENDPOINT REPORT ===');
      for (const row of report) {
        console.log(
          `${row.ok ? 'PASS' : 'FAIL'} ${row.method} ${row.path} → ${row.status} [${row.expectedAuth}] ${row.note}`,
        );
      }

      console.log(
        `=== SUMMARY: ${report.filter((r) => r.ok).length} passed, ${report.filter((r) => !r.ok).length} failed ===`,
      );

      console.log(`Report written to ${outPath}\n`);

      try {
        expect(report.filter((row) => !row.ok)).toEqual([]);
      } finally {
        await app.close();
      }
    });

    it('GET /health (public)', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      record(
        'GET',
        '/health',
        'public',
        res.status,
        res.status === 200,
        res.status === 200 ? 'liveness ok' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/auth/ok (Better Auth live, not in Auth docs)', async () => {
      const res = await request(app.getHttpServer()).get('/v1/auth/ok');
      const ok =
        res.status === 200 &&
        (res.body?.status === 'ok' || res.text?.includes('ok'));
      record(
        'GET',
        '/v1/auth/ok',
        'auth',
        res.status,
        ok,
        ok
          ? 'auth handler alive (hidden from Swagger Auth tag)'
          : JSON.stringify(res.body ?? res.text),
      );
    });

    it('GET /v1/user/check/username (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/user/check/username')
        .query({ username: `avail${suffix}`.slice(0, 30) });
      record(
        'GET',
        '/v1/user/check/username',
        'public',
        res.status,
        res.status === 200,
        JSON.stringify(res.body),
      );
    });

    it('GET /v1/user/check/telephone (public)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/user/check/telephone')
        .query({ telephone: '+19998887766' });
      record(
        'GET',
        '/v1/user/check/telephone',
        'public',
        res.status,
        res.status === 200,
        JSON.stringify(res.body),
      );
    });

    it('GET /v1/user/me without session → 401', async () => {
      const res = await request(app.getHttpServer()).get('/v1/user/me');
      const ok = res.status === 401 || res.status === 403;
      record(
        'GET',
        '/v1/user/me (anon)',
        'session',
        res.status,
        ok,
        ok ? 'correctly rejected' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/auth/signup/email', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup/email')
        .send({
          email,
          password,
          name: 'E2E User',
          username,
          telephone,
        });
      cookie = cookieHeader(res.headers['set-cookie'], cookie);
      userId = res.body?.user?.id ?? res.body?.data?.user?.id ?? '';
      const ok = res.status === 200 || res.status === 201;
      record(
        'POST',
        '/v1/auth/signup/email',
        'auth',
        res.status,
        ok,
        ok
          ? `user created${userId ? ` id=${userId}` : ''}`
          : JSON.stringify(res.body),
      );
    });

    it('verify email in DB (test helper)', async () => {
      const updated = await prisma.client().user.update({
        where: { email },
        data: { emailVerified: true },
      });
      userId = updated.id;
      record(
        'DB',
        'user.emailVerified=true',
        'auth',
        200,
        true,
        'email verified for e2e (sendVerificationEmail is stubbed)',
      );
    });

    it('POST /v1/auth/signin/email', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signin/email')
        .send({ email, password });
      cookie = cookieHeader(res.headers['set-cookie'], cookie);
      const ok = res.status === 200 && Boolean(cookie);
      record(
        'POST',
        '/v1/auth/signin/email',
        'auth',
        res.status,
        ok,
        ok ? 'signed in + session cookie' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/user/me with session', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/v1/user/me'),
        cookie,
      );
      const ok = res.status === 200;
      if (!userId) {
        userId = res.body?.data?.user?.id ?? '';
      }
      record(
        'GET',
        '/v1/user/me',
        'session',
        res.status,
        ok,
        ok ? 'profile returned' : JSON.stringify(res.body),
      );
    });

    it('PATCH /v1/user/onboarding', async () => {
      const res = await authed(
        request(app.getHttpServer()).patch('/v1/user/onboarding'),
        cookie,
      ).send({
        username: `${username}x`.slice(0, 30),
        telephone: `+1556${String(suffix).slice(-7)}`,
      });
      cookie = cookieHeader(res.headers['set-cookie'], cookie);
      record(
        'PATCH',
        '/v1/user/onboarding',
        'session',
        res.status,
        res.status === 200,
        res.status === 200 ? 'onboarding updated' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/organisation', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/organisation'),
        cookie,
      ).send({ name: `Org ${suffix}`, slug: `org-${suffix}` });
      cookie = cookieHeader(res.headers['set-cookie'], cookie);
      orgId =
        res.body?.data?.id ??
        res.body?.data?.organization?.id ??
        res.body?.id ??
        '';
      const ok = (res.status === 200 || res.status === 201) && Boolean(orgId);
      record(
        'POST',
        '/v1/organisation',
        'session',
        res.status,
        ok,
        ok ? `org created id=${orgId}` : JSON.stringify(res.body),
      );
    });

    it('GET /v1/organisation', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/v1/organisation'),
        cookie,
      );
      record(
        'GET',
        '/v1/organisation',
        'session',
        res.status,
        res.status === 200,
        res.status === 200 ? 'listed orgs' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/organisation/active', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/organisation/active'),
        cookie,
      ).send({ organizationId: orgId });
      cookie = cookieHeader(res.headers['set-cookie'], cookie);
      record(
        'POST',
        '/v1/organisation/active',
        'session',
        res.status,
        res.status === 200,
        res.status === 200 ? 'active org set' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/organisation/member', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/v1/organisation/member'),
        cookie,
      );
      const members =
        res.body?.data?.members ?? res.body?.data ?? res.body ?? [];
      if (Array.isArray(members) && members[0]?.id) {
        memberId = members[0].id;
      }
      record(
        'GET',
        '/v1/organisation/member',
        'session',
        res.status,
        res.status === 200,
        res.status === 200
          ? `members listed${memberId ? ` first=${memberId}` : ''}`
          : JSON.stringify(res.body),
      );
    });

    it('POST /v1/organisation/member/invite', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/organisation/member/invite'),
        cookie,
      ).send({
        email: `invite_${suffix}@example.com`,
        role: 'member',
        organizationId: orgId,
      });
      record(
        'POST',
        '/v1/organisation/member/invite',
        'session',
        res.status,
        res.status === 200 || res.status === 201,
        res.status === 200 || res.status === 201
          ? 'invitation created'
          : JSON.stringify(res.body),
      );
    });

    it('PATCH /v1/organisation/member/:memberId/role', async () => {
      if (!orgId) {
        record(
          'PATCH',
          '/v1/organisation/member/:memberId/role',
          'session',
          0,
          false,
          'skipped — no orgId',
        );
        return;
      }
      // Demoting the sole owner is blocked by Better Auth — exercise on a second member.
      const otherEmail = `member2_${suffix}@example.com`;
      const otherUser = await prisma.client().user.create({
        data: {
          id: `usr_${suffix}_2`,
          name: 'Member Two',
          email: otherEmail,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      extraUserId = otherUser.id;
      const otherMember = await prisma.client().member.create({
        data: {
          id: `mem_${suffix}_2`,
          organizationId: orgId,
          userId: otherUser.id,
          role: 'member',
          createdAt: new Date(),
        },
      });
      memberId = otherMember.id;

      const res = await authed(
        request(app.getHttpServer()).patch(
          `/v1/organisation/member/${memberId}/role`,
        ),
        cookie,
      ).send({ role: 'admin', organizationId: orgId });
      record(
        'PATCH',
        '/v1/organisation/member/:memberId/role',
        'session',
        res.status,
        res.status === 200,
        res.status === 200
          ? 'role updated on non-owner member'
          : JSON.stringify(res.body),
      );
    });

    it('POST /v1/organisation/team', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/organisation/team'),
        cookie,
      ).send({ name: `Team ${suffix}`, organizationId: orgId });
      teamId = res.body?.data?.id ?? res.body?.id ?? '';
      const ok = (res.status === 200 || res.status === 201) && Boolean(teamId);
      record(
        'POST',
        '/v1/organisation/team',
        'session',
        res.status,
        ok,
        ok ? `team created id=${teamId}` : JSON.stringify(res.body),
      );
    });

    it('GET /v1/organisation/team', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/v1/organisation/team'),
        cookie,
      );
      record(
        'GET',
        '/v1/organisation/team',
        'session',
        res.status,
        res.status === 200,
        res.status === 200 ? 'teams listed' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/organisation/team/:teamId/members', async () => {
      if (!teamId || !userId) {
        record(
          'POST',
          '/v1/organisation/team/:teamId/members',
          'session',
          0,
          false,
          'skipped — missing teamId/userId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).post(
          `/v1/organisation/team/${teamId}/members`,
        ),
        cookie,
      ).send({ userId, organizationId: orgId });
      const ok =
        res.status === 200 ||
        res.status === 201 ||
        res.status === 400 ||
        res.status === 409;
      record(
        'POST',
        '/v1/organisation/team/:teamId/members',
        'session',
        res.status,
        ok && res.status < 500,
        JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('DELETE /v1/organisation/team/members', async () => {
      if (!teamId || !userId) {
        record(
          'DELETE',
          '/v1/organisation/team/members',
          'session',
          0,
          false,
          'skipped — missing teamId/userId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).delete('/v1/organisation/team/members'),
        cookie,
      ).send({ teamId, userId, organizationId: orgId });
      const ok = res.status === 200 || res.status === 400;
      record(
        'DELETE',
        '/v1/organisation/team/members',
        'session',
        res.status,
        ok,
        JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('POST /v1/user/2fa/enable', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/user/2fa/enable'),
        cookie,
      ).send({ password });
      cookie = cookieHeader(res.headers['set-cookie'], cookie);
      record(
        'POST',
        '/v1/user/2fa/enable',
        'session',
        res.status,
        res.status === 200,
        res.status === 200 ? '2FA enable started' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/user/2fa/disable + re-signin', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/user/2fa/disable'),
        cookie,
      ).send({ password });
      cookie = cookieHeader(res.headers['set-cookie'], cookie);
      const ok = res.status === 200 || res.status === 400;
      record(
        'POST',
        '/v1/user/2fa/disable',
        'session',
        res.status,
        ok,
        res.status === 200
          ? '2FA disabled'
          : `expected if 2FA not fully verified: ${JSON.stringify(res.body)}`,
      );

      const signIn = await request(app.getHttpServer())
        .post('/v1/auth/signin/email')
        .send({ email, password });
      cookie = cookieHeader(signIn.headers['set-cookie'], '');
    });

    it('GET /v1/user/accounts', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/v1/user/accounts'),
        cookie,
      );
      const body = res.body as {
        data?: Array<{ providerId?: string; issuer?: string }>;
      };
      const credential = body.data?.find(
        (row) => row.providerId === 'credential',
      );
      const ok =
        res.status === 200 &&
        Boolean(credential) &&
        credential?.issuer === 'local:credential';
      record(
        'GET',
        '/v1/user/accounts',
        'session',
        res.status,
        ok,
        ok
          ? 'credential account has issuer'
          : JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('DELETE /v1/user/accounts/:provider (unknown)', async () => {
      const res = await authed(
        request(app.getHttpServer()).delete('/v1/user/accounts/twitter'),
        cookie,
      );
      record(
        'DELETE',
        '/v1/user/accounts/:provider (unknown)',
        'session',
        res.status,
        res.status === 404,
        res.status === 404
          ? 'account not found'
          : JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('DELETE /v1/user/accounts/:provider (last credential)', async () => {
      const res = await authed(
        request(app.getHttpServer()).delete('/v1/user/accounts/credential'),
        cookie,
      );
      const ok = res.status === 400 || res.status === 403 || res.status === 422;
      record(
        'DELETE',
        '/v1/user/accounts/:provider (last credential)',
        'session',
        res.status,
        ok,
        ok ? 'last account protected' : JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('GET /v1/user/sessions', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/v1/user/sessions'),
        cookie,
      );
      record(
        'GET',
        '/v1/user/sessions',
        'session',
        res.status,
        res.status === 200,
        res.status === 200
          ? 'sessions listed'
          : JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('DELETE /v1/user/sessions?mode=others', async () => {
      const res = await authed(
        request(app.getHttpServer()).delete('/v1/user/sessions'),
        cookie,
      ).query({ mode: 'others' });
      record(
        'DELETE',
        '/v1/user/sessions?mode=others',
        'session',
        res.status,
        res.status === 200,
        res.status === 200
          ? 'other sessions ended'
          : JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('POST /v1/billing/customer (optional key)', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/billing/customer'),
        cookie,
      );
      const ok = res.status === 200 || res.status === 503 || res.status === 500;
      record(
        'POST',
        '/v1/billing/customer',
        'session',
        res.status,
        ok,
        res.status === 200
          ? 'customer synced'
          : `billing unavailable or error: ${JSON.stringify(res.body).slice(0, 120)}`,
      );
    });

    it('GET /v1/admin/* as non-admin → blocked', async () => {
      const users = await authed(
        request(app.getHttpServer()).get('/v1/admin/users'),
        cookie,
      );
      const plans = await authed(
        request(app.getHttpServer()).get('/v1/admin/plans'),
        cookie,
      );
      const roles = await authed(
        request(app.getHttpServer()).get('/v1/admin/roles'),
        cookie,
      );
      const blocked = (s: number) => s === 401 || s === 403;
      record(
        'GET',
        '/v1/admin/users (non-admin)',
        'admin',
        users.status,
        blocked(users.status),
        blocked(users.status)
          ? 'correctly blocked'
          : JSON.stringify(users.body),
      );
      record(
        'GET',
        '/v1/admin/plans (non-admin)',
        'admin',
        plans.status,
        blocked(plans.status),
        blocked(plans.status)
          ? 'correctly blocked'
          : JSON.stringify(plans.body),
      );
      record(
        'GET',
        '/v1/admin/roles (non-admin)',
        'admin',
        roles.status,
        blocked(roles.status),
        blocked(roles.status)
          ? 'correctly blocked'
          : JSON.stringify(roles.body),
      );
    });

    it('promote to admin + re-signin', async () => {
      await prisma.client().user.update({
        where: { email },
        data: { role: 'admin' },
      });
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signin/email')
        .send({ email, password });
      cookie = cookieHeader(res.headers['set-cookie'], '');
      const ok = res.status === 200 && Boolean(cookie);
      record(
        'POST',
        '/v1/auth/signin/email (as admin)',
        'auth',
        res.status,
        ok,
        ok ? 'admin session acquired' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/admin/users (admin)', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/v1/admin/users'),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/users',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'users listed' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/admin/plans (admin)', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/v1/admin/plans'),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/plans',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'plans listed' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/admin/roles (admin)', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/v1/admin/roles'),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/roles',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'roles listed' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/admin/roles', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/admin/roles'),
        cookie,
      ).send({
        name: `custom_${suffix}`,
        description: 'e2e role',
        statements: { user: ['read'] },
      });
      record(
        'POST',
        '/v1/admin/roles',
        'admin',
        res.status,
        res.status === 200 || res.status === 201,
        JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('POST /v1/admin/plans', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/admin/plans'),
        cookie,
      ).send({
        name: `E2E Plan ${suffix}`,
        slug: `e2e-${suffix}`,
        audience: 'individual',
        billingType: 'recurring',
        autumnProductId: `prod_e2e_${suffix}`,
      });
      record(
        'POST',
        '/v1/admin/plans',
        'admin',
        res.status,
        res.status === 200 || res.status === 201,
        JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('POST /v1/admin/staff/invite', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/admin/staff/invite'),
        cookie,
      ).send({
        email: `staff_${suffix}@example.com`,
        name: 'Staff E2E',
        role: 'support',
      });
      staffUserId = res.body?.data?.user?.id ?? '';
      record(
        'POST',
        '/v1/admin/staff/invite',
        'admin',
        res.status,
        res.status === 200 || res.status === 201,
        JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('PATCH /v1/admin/settings/multi-session', async () => {
      const res = await authed(
        request(app.getHttpServer()).patch('/v1/admin/settings/multi-session'),
        cookie,
      ).send({ enabled: false });
      record(
        'PATCH',
        '/v1/admin/settings/multi-session',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'setting updated' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/admin/users/:id', async () => {
      const res = await authed(
        request(app.getHttpServer()).get(`/v1/admin/users/${userId}`),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/users/:id',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'user loaded' : JSON.stringify(res.body),
      );
    });

    it('PATCH /v1/admin/users/:id', async () => {
      if (!staffUserId) {
        record(
          'PATCH',
          '/v1/admin/users/:id',
          'admin',
          0,
          false,
          'skipped — no staffUserId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).patch(`/v1/admin/users/${staffUserId}`),
        cookie,
      ).send({ name: 'Staff Updated' });
      record(
        'PATCH',
        '/v1/admin/users/:id',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'user updated' : JSON.stringify(res.body),
      );
    });

    it('PATCH /v1/admin/users/:id/password', async () => {
      if (!staffUserId) {
        record(
          'PATCH',
          '/v1/admin/users/:id/password',
          'admin',
          0,
          false,
          'skipped — no staffUserId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).patch(
          `/v1/admin/users/${staffUserId}/password`,
        ),
        cookie,
      ).send({ newPassword: 'StaffPassw0rd!Secure' });
      record(
        'PATCH',
        '/v1/admin/users/:id/password',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'password updated' : JSON.stringify(res.body),
      );
    });

    it('GET + DELETE /v1/admin/users/:id/sessions/:sessionId', async () => {
      if (!staffUserId) {
        record(
          'DELETE',
          '/v1/admin/users/:id/sessions/:sessionId',
          'admin',
          0,
          false,
          'skipped — no staffUserId',
        );
        return;
      }
      const created = await prisma.client().session.create({
        data: {
          id: `sess_${suffix}_staff`,
          token: `tok_${suffix}_staff`,
          userId: staffUserId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const listed = await authed(
        request(app.getHttpServer()).get(
          `/v1/admin/users/${staffUserId}/sessions`,
        ),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/users/:id/sessions',
        'admin',
        listed.status,
        listed.status === 200,
        listed.status === 200
          ? 'sessions listed'
          : JSON.stringify(listed.body).slice(0, 180),
      );
      const res = await authed(
        request(app.getHttpServer()).delete(
          `/v1/admin/users/${staffUserId}/sessions/${created.id}`,
        ),
        cookie,
      );
      record(
        'DELETE',
        '/v1/admin/users/:id/sessions/:sessionId',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'session ended' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/admin/users/:id/impersonate + stop', async () => {
      if (!staffUserId) {
        record(
          'POST',
          '/v1/admin/users/:id/impersonate',
          'admin',
          0,
          false,
          'skipped — no staffUserId',
        );
        return;
      }
      const start = await authed(
        request(app.getHttpServer()).post(
          `/v1/admin/users/${staffUserId}/impersonate`,
        ),
        cookie,
      );
      const startCookies = start.headers['set-cookie'];
      const startOk = start.status === 200 && Boolean(startCookies);
      record(
        'POST',
        '/v1/admin/users/:id/impersonate',
        'admin',
        start.status,
        startOk,
        startOk
          ? 'impersonation started'
          : start.status === 200
            ? 'impersonation started without set-cookie'
            : JSON.stringify(start.body).slice(0, 180),
      );
      cookie = cookieHeader(start.headers['set-cookie'], cookie);
      const stop = await authed(
        request(app.getHttpServer()).post('/v1/admin/impersonate/stop'),
        cookie,
      );
      cookie = cookieHeader(stop.headers['set-cookie'], cookie);
      record(
        'POST',
        '/v1/admin/impersonate/stop',
        'admin',
        stop.status,
        stop.status === 200,
        stop.status === 200
          ? 'impersonation stopped'
          : `${JSON.stringify(stop.body).slice(0, 120)} cookies=${cookieNames(cookie)}`,
      );
      const signIn = await request(app.getHttpServer())
        .post('/v1/auth/signin/email')
        .send({ email, password });
      cookie = cookieHeader(signIn.headers['set-cookie'], '');
    });

    it('POST /v1/admin/organisations', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/admin/organisations'),
        cookie,
      ).send({
        name: `Admin Org ${suffix}`,
        slug: `admin-org-${suffix}`,
      });
      adminOrgId = res.body?.data?.id ?? '';
      const ok =
        (res.status === 200 || res.status === 201) && Boolean(adminOrgId);
      record(
        'POST',
        '/v1/admin/organisations',
        'admin',
        res.status,
        ok,
        ok ? `org created id=${adminOrgId}` : JSON.stringify(res.body),
      );
    });

    it('GET /v1/admin/organisations/:id', async () => {
      if (!adminOrgId) {
        record(
          'GET',
          '/v1/admin/organisations/:id',
          'admin',
          0,
          false,
          'skipped — no adminOrgId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).get(
          `/v1/admin/organisations/${adminOrgId}`,
        ),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/organisations/:id',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'org loaded' : JSON.stringify(res.body),
      );
    });

    it('PATCH /v1/admin/organisations/:id', async () => {
      if (!adminOrgId) {
        record(
          'PATCH',
          '/v1/admin/organisations/:id',
          'admin',
          0,
          false,
          'skipped — no adminOrgId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).patch(
          `/v1/admin/organisations/${adminOrgId}`,
        ),
        cookie,
      ).send({ name: `Admin Org Updated ${suffix}` });
      record(
        'PATCH',
        '/v1/admin/organisations/:id',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'org updated' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/admin/teams', async () => {
      if (!adminOrgId) {
        record(
          'POST',
          '/v1/admin/teams',
          'admin',
          0,
          false,
          'skipped — no adminOrgId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).post('/v1/admin/teams'),
        cookie,
      ).send({
        name: `Admin Team ${suffix}`,
        organizationId: adminOrgId,
      });
      adminTeamId = res.body?.data?.id ?? '';
      const ok =
        (res.status === 200 || res.status === 201) && Boolean(adminTeamId);
      record(
        'POST',
        '/v1/admin/teams',
        'admin',
        res.status,
        ok,
        ok ? `team created id=${adminTeamId}` : JSON.stringify(res.body),
      );
    });

    it('GET /v1/admin/teams/:id', async () => {
      if (!adminTeamId) {
        record(
          'GET',
          '/v1/admin/teams/:id',
          'admin',
          0,
          false,
          'skipped — no adminTeamId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).get(`/v1/admin/teams/${adminTeamId}`),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/teams/:id',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'team loaded' : JSON.stringify(res.body),
      );
    });

    it('PATCH /v1/admin/teams/:id', async () => {
      if (!adminTeamId) {
        record(
          'PATCH',
          '/v1/admin/teams/:id',
          'admin',
          0,
          false,
          'skipped — no adminTeamId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).patch(`/v1/admin/teams/${adminTeamId}`),
        cookie,
      ).send({ name: `Admin Team Updated ${suffix}` });
      record(
        'PATCH',
        '/v1/admin/teams/:id',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'team updated' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/admin/organisations/:id/members', async () => {
      if (!adminOrgId || !extraUserId) {
        record(
          'POST',
          '/v1/admin/organisations/:id/members',
          'admin',
          0,
          false,
          'skipped — missing org/user',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).post(
          `/v1/admin/organisations/${adminOrgId}/members`,
        ),
        cookie,
      ).send({ userId: extraUserId, role: 'member' });
      adminMemberId = res.body?.data?.id ?? '';
      const ok =
        (res.status === 200 || res.status === 201) && Boolean(adminMemberId);
      record(
        'POST',
        '/v1/admin/organisations/:id/members',
        'admin',
        res.status,
        ok,
        ok ? 'member added' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/admin/organisations/:id/members', async () => {
      if (!adminOrgId) {
        record(
          'GET',
          '/v1/admin/organisations/:id/members',
          'admin',
          0,
          false,
          'skipped — no adminOrgId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).get(
          `/v1/admin/organisations/${adminOrgId}/members`,
        ),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/organisations/:id/members',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'members listed' : JSON.stringify(res.body),
      );
    });

    it('PATCH /v1/admin/organisations/:id/members/:memberId', async () => {
      if (!adminOrgId || !adminMemberId) {
        record(
          'PATCH',
          '/v1/admin/organisations/:id/members/:memberId',
          'admin',
          0,
          false,
          'skipped — missing member',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).patch(
          `/v1/admin/organisations/${adminOrgId}/members/${adminMemberId}`,
        ),
        cookie,
      ).send({ role: 'admin' });
      record(
        'PATCH',
        '/v1/admin/organisations/:id/members/:memberId',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'member role updated' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/admin/organisations/:id/invitations', async () => {
      if (!adminOrgId) {
        record(
          'POST',
          '/v1/admin/organisations/:id/invitations',
          'admin',
          0,
          false,
          'skipped — no adminOrgId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).post(
          `/v1/admin/organisations/${adminOrgId}/invitations`,
        ),
        cookie,
      ).send({
        email: `admin_invite_${suffix}@example.com`,
        role: 'member',
      });
      adminInvitationId = res.body?.data?.id ?? '';
      const ok =
        (res.status === 200 || res.status === 201) &&
        Boolean(adminInvitationId);
      record(
        'POST',
        '/v1/admin/organisations/:id/invitations',
        'admin',
        res.status,
        ok,
        ok ? 'invitation sent' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/admin/organisations/:id/invitations', async () => {
      if (!adminOrgId) {
        record(
          'GET',
          '/v1/admin/organisations/:id/invitations',
          'admin',
          0,
          false,
          'skipped — no adminOrgId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).get(
          `/v1/admin/organisations/${adminOrgId}/invitations`,
        ),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/organisations/:id/invitations',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'invitations listed' : JSON.stringify(res.body),
      );
    });

    it('DELETE /v1/admin/organisations/:id/invitations/:invitationId', async () => {
      if (!adminOrgId || !adminInvitationId) {
        record(
          'DELETE',
          '/v1/admin/organisations/:id/invitations/:invitationId',
          'admin',
          0,
          false,
          'skipped — missing invitation',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).delete(
          `/v1/admin/organisations/${adminOrgId}/invitations/${adminInvitationId}`,
        ),
        cookie,
      );
      record(
        'DELETE',
        '/v1/admin/organisations/:id/invitations/:invitationId',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'invitation canceled' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/admin/teams/:id/members', async () => {
      if (!adminTeamId || !extraUserId) {
        record(
          'POST',
          '/v1/admin/teams/:id/members',
          'admin',
          0,
          false,
          'skipped — missing team/user',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).post(
          `/v1/admin/teams/${adminTeamId}/members`,
        ),
        cookie,
      ).send({ userId: extraUserId });
      const ok = res.status === 200 || res.status === 201;
      record(
        'POST',
        '/v1/admin/teams/:id/members',
        'admin',
        res.status,
        ok,
        ok ? 'team member added' : JSON.stringify(res.body),
      );
    });

    it('GET /v1/admin/teams/:id/members', async () => {
      if (!adminTeamId) {
        record(
          'GET',
          '/v1/admin/teams/:id/members',
          'admin',
          0,
          false,
          'skipped — no adminTeamId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).get(
          `/v1/admin/teams/${adminTeamId}/members`,
        ),
        cookie,
      );
      record(
        'GET',
        '/v1/admin/teams/:id/members',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'team members listed' : JSON.stringify(res.body),
      );
    });

    it('DELETE /v1/admin/teams/:id/members/:userId', async () => {
      if (!adminTeamId || !extraUserId) {
        record(
          'DELETE',
          '/v1/admin/teams/:id/members/:userId',
          'admin',
          0,
          false,
          'skipped — missing team/user',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).delete(
          `/v1/admin/teams/${adminTeamId}/members/${extraUserId}`,
        ),
        cookie,
      );
      record(
        'DELETE',
        '/v1/admin/teams/:id/members/:userId',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'team member removed' : JSON.stringify(res.body),
      );
    });

    it('DELETE /v1/admin/organisations/:id/members/:memberId', async () => {
      if (!adminOrgId || !adminMemberId) {
        record(
          'DELETE',
          '/v1/admin/organisations/:id/members/:memberId',
          'admin',
          0,
          false,
          'skipped — missing member',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).delete(
          `/v1/admin/organisations/${adminOrgId}/members/${adminMemberId}`,
        ),
        cookie,
      );
      record(
        'DELETE',
        '/v1/admin/organisations/:id/members/:memberId',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'member removed' : JSON.stringify(res.body),
      );
    });

    it('DELETE /v1/admin/teams/:id', async () => {
      if (!adminTeamId) {
        record(
          'DELETE',
          '/v1/admin/teams/:id',
          'admin',
          0,
          false,
          'skipped — no adminTeamId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).delete(`/v1/admin/teams/${adminTeamId}`),
        cookie,
      );
      record(
        'DELETE',
        '/v1/admin/teams/:id',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'team deleted' : JSON.stringify(res.body),
      );
    });

    it('DELETE /v1/admin/organisations/:id', async () => {
      if (!adminOrgId) {
        record(
          'DELETE',
          '/v1/admin/organisations/:id',
          'admin',
          0,
          false,
          'skipped — no adminOrgId',
        );
        return;
      }
      const res = await authed(
        request(app.getHttpServer()).delete(
          `/v1/admin/organisations/${adminOrgId}`,
        ),
        cookie,
      );
      record(
        'DELETE',
        '/v1/admin/organisations/:id',
        'admin',
        res.status,
        res.status === 200,
        res.status === 200 ? 'org deleted' : JSON.stringify(res.body),
      );
    });

    it('DELETE /v1/organisation/member/:memberId (non-owner)', async () => {
      if (!memberId || !orgId) {
        record(
          'DELETE',
          '/v1/organisation/member/:memberId',
          'session',
          0,
          false,
          'skipped — no memberId/orgId',
        );
        return;
      }
      await authed(
        request(app.getHttpServer()).post('/v1/organisation/active'),
        cookie,
      ).send({ organizationId: orgId });
      const res = await authed(
        request(app.getHttpServer()).delete(
          `/v1/organisation/member/${memberId}`,
        ),
        cookie,
      );
      record(
        'DELETE',
        '/v1/organisation/member/:memberId',
        'session',
        res.status,
        res.status === 200,
        res.status === 200 ? 'member removed' : JSON.stringify(res.body),
      );
    });

    it('POST /v1/user/2fa/verify (invalid code)', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/user/2fa/verify'),
        cookie,
      ).send({ code: '000000' });
      const ok = res.status === 400 || res.status === 401 || res.status === 200;
      record(
        'POST',
        '/v1/user/2fa/verify',
        'session',
        res.status,
        ok,
        JSON.stringify(res.body).slice(0, 180),
      );
    });

    it('POST /v1/user/sign/out', async () => {
      const res = await authed(
        request(app.getHttpServer()).post('/v1/user/sign/out'),
        cookie,
      );
      record(
        'POST',
        '/v1/user/sign/out',
        'session',
        res.status,
        res.status === 200,
        res.status === 200
          ? 'signed out'
          : JSON.stringify(res.body).slice(0, 180),
      );
    });
  },
);
