export function isMultiSessionEnabled(): boolean {
  const v = process.env.MULTI_SESSION_ENABLED?.trim().toLowerCase();
  if (v === 'false' || v === '0') return false;
  return true;
}

function asBooleanFlag(value: string | undefined): boolean | undefined {
  const raw = value?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true' || raw === '1') return true;
  return undefined;
}

/**
 * Free-trial abuse requires a KV visitor id. Curl, Swagger, and Scalar cannot
 * supply one, so the check stays off unless production (or an explicit override).
 */
export function isFreeTrialAbuseEnabled(
  nodeEnv = process.env.NODE_ENV,
  override = process.env.SENTINEL_FREE_TRIAL_ABUSE,
): boolean {
  const flagged = asBooleanFlag(override);
  if (flagged !== undefined) {
    return flagged;
  }
  return nodeEnv === 'production';
}
