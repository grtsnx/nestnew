import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CREDENTIAL_ISSUER,
  oauthSyntheticIssuer,
  resolveAccountForUnlink,
} from 'src/lib/betterauth/account-issuer';

describe('account issuer helpers', () => {
  it('uses local:credential for email/password accounts', () => {
    expect(CREDENTIAL_ISSUER).toBe('local:credential');
  });

  it('builds synthetic OAuth issuers with encoding', () => {
    expect(oauthSyntheticIssuer('google')).toBe('local:oauth:google');
    expect(oauthSyntheticIssuer('github')).toBe('local:oauth:github');
    expect(oauthSyntheticIssuer('team/github')).toBe(
      'local:oauth:team%2Fgithub',
    );
  });
});

describe('resolveAccountForUnlink', () => {
  const accounts = [
    {
      id: 'acc_local_1',
      providerId: 'credential',
      accountId: 'user_1',
      issuer: CREDENTIAL_ISSUER,
    },
    {
      id: 'acc_google_1',
      providerId: 'google',
      accountId: 'google-sub-123',
      issuer: oauthSyntheticIssuer('google'),
    },
    {
      id: 'acc_github_1',
      providerId: 'github',
      accountId: 'github-sub-456',
      issuer: oauthSyntheticIssuer('github'),
    },
  ];

  it('finds accounts by providerId', () => {
    expect(resolveAccountForUnlink(accounts, 'google')?.id).toBe(
      'acc_google_1',
    );
    expect(resolveAccountForUnlink(accounts, 'github')?.id).toBe(
      'acc_github_1',
    );
    expect(resolveAccountForUnlink(accounts, 'credential')?.id).toBe(
      'acc_local_1',
    );
  });

  it('finds accounts by local id', () => {
    expect(resolveAccountForUnlink(accounts, 'acc_github_1')?.providerId).toBe(
      'github',
    );
  });

  it('finds accounts by provider accountId', () => {
    expect(
      resolveAccountForUnlink(accounts, 'google-sub-123')?.providerId,
    ).toBe('google');
  });

  it('returns undefined for unknown selectors', () => {
    expect(resolveAccountForUnlink(accounts, 'twitter')).toBeUndefined();
  });
});

describe('account issuer migration', () => {
  it('backfills credential and OAuth issuers', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'prisma/migrations/20260818025000_account_issuer/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toContain("'local:credential'");
    expect(sql).toContain('\'local:oauth:\' || "providerId"');
    expect(sql).toContain('account_issuer_accountId_key');
  });
});
