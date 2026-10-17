import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '../../..');

const SEED_FILES = [
  'prisma/seed.ts',
  'src/lib/prisma/seed/index.ts',
  'src/lib/prisma/seed/seedAdmin.ts',
] as const;

/** Imports that pull Nest/bootstrap graphs and break `bun prisma db seed`. */
const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /from ['"]src\/middleware['"]/,
  /from ['"]src\/lib['"]/,
  /from ['"].*\/prisma\.service['"]/,
  /from ['"]@nestjs\//,
];

describe('prisma seed import safety', () => {
  it.each(SEED_FILES)('%s avoids Nest/middleware/prisma.service imports', (relativePath) => {
    const source = readFileSync(join(repoRoot, relativePath), 'utf8');
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it('loads seed modules without circular initialization errors', async () => {
    await expect(
      import('src/lib/prisma/pg-connection.js')
    ).resolves.toBeDefined();
    await expect(
      import('src/lib/prisma/seed/seedAdmin.js')
    ).resolves.toBeDefined();
    await expect(
      import('src/lib/prisma/seed/index.js')
    ).resolves.toBeDefined();
  });
});
