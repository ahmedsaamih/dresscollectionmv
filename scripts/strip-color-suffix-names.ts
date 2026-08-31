// One-time fix: earlier runs of split-production-colors.ts named each
// split-off product "<Name> — <Color>". The convention changed so every
// color of a dress shares the same name (colour is conveyed by the swatch,
// not the name) — this strips that " — Color" suffix from any product name
// that still has it. Safe to re-run: nothing to do once no names match.
//
// Usage:
//   DATABASE_URL="<target-db-url>" npx tsx scripts/strip-color-suffix-names.ts --dry-run
//   DATABASE_URL="<target-db-url>" npx tsx scripts/strip-color-suffix-names.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`Connected to: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);
  console.log(DRY_RUN ? 'Mode: DRY RUN (no writes)\n' : 'Mode: LIVE (will write)\n');

  const products = await prisma.product.findMany({ where: { name: { contains: ' — ' } } });
  console.log(`${products.length} product(s) with a " — " suffix in their name.`);

  for (const p of products) {
    const base = p.name.split(' — ')[0].trim();
    console.log(`  ${p.id}: "${p.name}" -> "${base}"`);
    if (!DRY_RUN) await prisma.product.update({ where: { id: p.id }, data: { name: base } });
  }

  console.log(DRY_RUN ? '\nDry run complete — no changes written. Re-run without --dry-run to apply.' : '\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
