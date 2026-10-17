import { createId } from '@paralleldrive/cuid2';
import type { PrismaClient } from 'src/lib/prisma/generated/client';

import { hashPassword } from 'src/lib/betterauth/password';
import { CREDENTIAL_ISSUER } from 'src/lib/betterauth/account-issuer';
import { grantSignupCreditsIfEligible } from 'src/lib/betterauth/credits';
import { resolveProfileImage } from 'src/lib/gravatar/gravatar.service';

/**
 * Upserts the platform admin from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 * Skips when email or password env vars are missing.
 */
export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Admin';

  if (!email || !password) {
    console.log(
      'Skipping admin seed (set ADMIN_EMAIL and ADMIN_PASSWORD to create one)',
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const userId = existing?.id ?? createId();
  const hashed = await hashPassword(password);
  const image = resolveProfileImage(email, process.env.DICEBEAR_STYLE);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      id: userId,
      email,
      name,
      emailVerified: true,
      role: 'admin',
      image,
    },
    update: {
      name,
      emailVerified: true,
      role: 'admin',
      image,
    },
  });

  const credential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: 'credential' },
  });

  if (credential) {
    await prisma.account.update({
      where: { id: credential.id },
      data: {
        password: hashed,
        accountId: user.id,
        issuer: CREDENTIAL_ISSUER,
      },
    });
  } else {
    await prisma.account.create({
      data: {
        id: createId(),
        accountId: user.id,
        providerId: 'credential',
        issuer: CREDENTIAL_ISSUER,
        userId: user.id,
        password: hashed,
      },
    });
  }

  await grantSignupCreditsIfEligible(prisma, user.id);

  console.log(`Seeded admin user (${email})`);
}
