/**
 * Seed modules — no Nest modules, middleware barrels, or prisma.service imports.
 * Use `src/lib/prisma/pg-connection` for DATABASE_URL normalization.
 */
import type { PrismaClient } from 'src/lib/prisma/generated/client';

import { roles } from 'src/lib/betterauth/permissions';

import { seedAdmin } from './seedAdmin';

const SYSTEM_ROLES: Array<{
  name: keyof typeof roles;
  description: string;
}> = [
  { name: 'admin', description: 'Full platform administration' },
  { name: 'support', description: 'Support ticket and user read access' },
  { name: 'developer', description: 'Developer ops read access' },
  { name: 'finance_officer', description: 'Plan billing read/update' },
  { name: 'user', description: 'Default end-user role' },
];

async function seedPlans(prisma: PrismaClient): Promise<void> {
  await prisma.plan.upsert({
    where: { slug: 'free' },
    create: {
      name: 'Free',
      slug: 'free',
      description: 'Free individual plan',
      audience: 'individual',
      billingType: 'free',
      active: true,
      sortOrder: 0,
    },
    update: {
      name: 'Free',
      description: 'Free individual plan',
      audience: 'individual',
      billingType: 'free',
      active: true,
    },
  });
}

async function seedRoles(prisma: PrismaClient): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    const statements = roles[role.name].statements;
    await prisma.platformRole.upsert({
      where: { name: role.name },
      create: {
        name: role.name,
        description: role.description,
        statements,
        isSystem: true,
        active: true,
      },
      update: {
        description: role.description,
        statements,
        isSystem: true,
        active: true,
      },
    });
  }
}

export async function runSeed(prisma: PrismaClient): Promise<void> {
  await seedPlans(prisma);
  await seedRoles(prisma);
  await seedAdmin(prisma);
  console.log('Seed complete');
}

export { seedAdmin };
