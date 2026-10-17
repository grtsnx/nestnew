import { hashPassword, verifyPassword } from 'src/lib';

describe('password helpers', () => {
  it('hashes with argon2 and verifies', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash.startsWith('$argon2')).toBe(true);
    await expect(
      verifyPassword({
        hash,
        password: 'correct-horse-battery-staple',
      }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword({
        hash,
        password: 'wrong-password',
      }),
    ).resolves.toBe(false);
  });
});
