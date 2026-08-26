import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

// Excludes 0/O and 1/I/L — visually ambiguous characters that cause
// transcription errors when a customer reads/types the code (e.g. into a
// bank transfer note).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomOrderCode(len = 5): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

/**
 * Runs `work` inside a transaction, generating a fresh random 5-character
 * order code on each attempt. A random code (unlike the old sequential
 * counter) needs explicit collision handling: if the code collides with an
 * existing Order id (P2002 on the primary key), the whole transaction is
 * retried with a new code, up to 5 attempts.
 */
export async function createOrderWithRef<T>(
  work: (tx: Prisma.TransactionClient, ref: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction((tx) => work(tx, randomOrderCode()));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error('unreachable');
}
