import { isFreeTrialAbuseEnabled } from 'src/lib';

describe('isFreeTrialAbuseEnabled', () => {
  it('is off in non-production so curl and Scalar can sign up', () => {
    expect(isFreeTrialAbuseEnabled('development')).toBe(false);
    expect(isFreeTrialAbuseEnabled('test')).toBe(false);
    expect(isFreeTrialAbuseEnabled(undefined)).toBe(false);
  });

  it('is on in production', () => {
    expect(isFreeTrialAbuseEnabled('production')).toBe(true);
  });

  it('honors SENTINEL_FREE_TRIAL_ABUSE over NODE_ENV', () => {
    expect(isFreeTrialAbuseEnabled('production', 'false')).toBe(false);
    expect(isFreeTrialAbuseEnabled('development', 'true')).toBe(true);
  });
});
