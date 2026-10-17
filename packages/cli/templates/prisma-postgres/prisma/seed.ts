import 'dotenv/config';

/**
 * Prisma seed entrypoint — must stay free of Nest/middleware barrels so `bun prisma db seed`
 * works outside the HTTP app. Import helpers from leaf modules only (see seed-imports.spec.ts).
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/lib/prisma/generated/client';
import { runSeed } from '../src/lib/prisma/seed';
import { normalizePgConnectionString } from '../src/lib/prisma/pg-connection';

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required to seed');
  }
  return normalizePgConnectionString(url);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }),
});

runSeed(prisma)
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
