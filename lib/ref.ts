import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Atomically generate the next sequential reference, e.g. "DC-26-48214".
 * Uses a single Postgres INSERT … ON CONFLICT DO UPDATE so concurrent
 * requests can never collide. Pass a transaction client when inside one.
 */
export async function nextRef(prefix: 'DC' | 'QT', db: Db = prisma): Promise<string> {
  const year = new Date().getFullYear().toString().slice(2);
  const rows = await db.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "RefSequence" ("prefix", "year", "lastValue")
    VALUES (${prefix}, ${year}, 10001)
    ON CONFLICT ("prefix", "year")
    DO UPDATE SET "lastValue" = "RefSequence"."lastValue" + 1
    RETURNING "lastValue"`;
  return `${prefix}-${year}-${rows[0].lastValue}`;
}
