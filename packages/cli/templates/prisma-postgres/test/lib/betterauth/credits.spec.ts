import {
  applyCreditBalanceToAuthPayload,
  DEFAULT_SIGNUP_CREDITS,
  extractAuthUserId,
  grantAndAttachSignupCredits,
  grantSignupCreditsIfEligible,
  mapCreditRewardError,
  parseCreditAmount,
  parseCreditAudience,
  parseRewardAmount,
  SIGNUP_GRANT_REASON,
} from 'src/lib';

describe('credit helpers', () => {
  it('parses signup credit amounts and rejects invalid values', () => {
    expect(parseCreditAmount('150')).toBe(150);
    expect(parseCreditAmount(0)).toBe(0);
    expect(parseCreditAmount('nope')).toBe(DEFAULT_SIGNUP_CREDITS);
    expect(parseCreditAmount(-5)).toBe(DEFAULT_SIGNUP_CREDITS);
    expect(parseCreditAmount(1.5)).toBe(DEFAULT_SIGNUP_CREDITS);
  });

  it('accepts only whole positive reward amounts', () => {
    expect(parseRewardAmount(25)).toBe(25);
    expect(parseRewardAmount(0)).toBeNull();
    expect(parseRewardAmount(-1)).toBeNull();
    expect(parseRewardAmount('10')).toBe(10);
  });

  it('accepts user, team, and organisation reward targets', () => {
    expect(parseCreditAudience('user')).toBe('user');
    expect(parseCreditAudience('team')).toBe('team');
    expect(parseCreditAudience('organization')).toBe('organization');
    expect(parseCreditAudience('organisation')).toBe('organization');
    expect(parseCreditAudience('wallet')).toBeNull();
  });

  it('maps missing reward targets to short client messages', () => {
    expect(mapCreditRewardError(new Error('Invalid reward amount'))).toEqual({
      status: 400,
      message: 'Invalid reward amount',
    });
    expect(mapCreditRewardError(new Error('USER_MISSING'))).toEqual({
      status: 404,
      message: 'Account missing',
    });
    expect(mapCreditRewardError(new Error('TEAM_MISSING'))).toEqual({
      status: 404,
      message: 'Team missing',
    });
    expect(mapCreditRewardError(new Error('ORGANIZATION_MISSING'))).toEqual({
      status: 404,
      message: 'Organisation missing',
    });
    expect(mapCreditRewardError(new Error('other'))).toBeNull();
  });

  it('uses a stable signup grant ledger reason', () => {
    expect(SIGNUP_GRANT_REASON).toBe('signup grant');
  });

  it('skips signup credits when email is not verified', async () => {
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ emailVerified: false }),
      },
    };

    const granted = await grantSignupCreditsIfEligible(
      db as unknown as Parameters<typeof grantSignupCreditsIfEligible>[0],
      'user_1',
    );

    expect(granted).toBe(false);
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      select: { emailVerified: true },
    });
  });

  it('copies the stored credit balance onto login payloads', () => {
    expect(extractAuthUserId({ token: 't', user: { id: 'user_1' } })).toBe(
      'user_1',
    );
    expect(
      applyCreditBalanceToAuthPayload(
        {
          status: true,
          token: 't',
          user: { id: 'user_1', emailVerified: true, creditBalance: 0 },
        },
        100,
      ),
    ).toEqual({
      status: true,
      token: 't',
      user: { id: 'user_1', emailVerified: true, creditBalance: 100 },
    });
  });

  it('grants and attaches credits for verified login users', async () => {
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ emailVerified: true })
          .mockResolvedValueOnce({ creditBalance: 100 }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
        await fn({
          creditLedger: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'led_1' }),
          },
          user: {
            update: jest.fn().mockResolvedValue({ creditBalance: 100 }),
          },
        });
      }),
      platformSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const payload = await grantAndAttachSignupCredits(
      db as unknown as Parameters<typeof grantAndAttachSignupCredits>[0],
      {
        status: true,
        token: 't',
        user: { id: 'user_1', emailVerified: true, creditBalance: 0 },
      },
    );

    expect(payload).toMatchObject({
      user: { id: 'user_1', creditBalance: 100 },
    });
  });
});
