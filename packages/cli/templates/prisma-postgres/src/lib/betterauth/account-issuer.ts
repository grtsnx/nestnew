/** Better Auth 1.7 credential account issuer. */
export const CREDENTIAL_ISSUER = 'local:credential';

/** Synthetic issuer for OAuth providers without a trusted OIDC issuer. */
export function oauthSyntheticIssuer(providerId: string): string {
  return `local:oauth:${encodeURIComponent(providerId)}`;
}

export type LinkedAccountRow = {
  id: string;
  providerId: string;
  accountId: string;
  issuer?: string | null;
};

/** Resolve a route selector to the local Better Auth account row id. */
export function resolveAccountForUnlink(
  accounts: LinkedAccountRow[],
  selector: string,
): LinkedAccountRow | undefined {
  return accounts.find(
    (row) =>
      row.providerId === selector ||
      row.id === selector ||
      row.accountId === selector,
  );
}
