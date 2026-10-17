/**
 * Silence pg-connection-string deprecation noise for Neon-style
 * `sslmode=require|prefer|verify-ca` URLs by opting into current libpq-compat
 * semantics until callers migrate to `sslmode=verify-full`.
 */
export function normalizePgConnectionString(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const sslMode = (parsed.searchParams.get('sslmode') ?? '').toLowerCase();
  const needsCompat = ['require', 'prefer', 'verify-ca'].includes(sslMode);
  if (!needsCompat) {
    return trimmed;
  }
  if (parsed.searchParams.has('uselibpqcompat')) {
    return trimmed;
  }

  parsed.searchParams.set('uselibpqcompat', 'true');
  return parsed.toString();
}
