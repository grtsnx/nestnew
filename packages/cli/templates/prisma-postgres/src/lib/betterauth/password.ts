import { hash, verify, type Options } from '@node-rs/argon2';
import { verifyPassword as verifyScryptPassword } from 'better-auth/crypto';

/** OWASP-aligned Argon2id defaults for password hashing. */
const argon2Options: Options = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
  algorithm: 2,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, argon2Options);
}

/**
 * Verify against Argon2id first; fall back to Better Auth scrypt so
 * existing accounts keep working until they next change password.
 */
export async function verifyPassword(input: {
  password: string;
  hash: string;
}): Promise<boolean> {
  const { password, hash: storedHash } = input;
  if (storedHash.startsWith('$argon2')) {
    return verify(storedHash, password, argon2Options);
  }
  return verifyScryptPassword({ hash: storedHash, password });
}
