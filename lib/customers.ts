import { prisma } from '@/lib/prisma';
import { genId } from '@/lib/admin-guard';

interface ContactInput {
  name: string;
  phone: string | null | undefined;
  email?: string | null;
}

/**
 * Best-effort upsert of a Customer row keyed by phone number, called after an
 * Order or Quote is successfully created. No-ops when phone is blank (phone
 * is the dedup key). Never throws — a failure here must not affect the
 * order/quote that triggered it.
 */
export async function upsertCustomerFromContact({ name, phone, email }: ContactInput): Promise<void> {
  const trimmedPhone = phone?.trim();
  if (!trimmedPhone) return;

  const trimmedName = name.trim() || 'Unknown';
  const trimmedEmail = email?.trim() || null;

  try {
    await prisma.customer.upsert({
      where: { phone: trimmedPhone },
      create: { id: genId('cust'), name: trimmedName, phone: trimmedPhone, email: trimmedEmail },
      update: { name: trimmedName, email: trimmedEmail },
    });
  } catch (e) {
    console.error('customer upsert failed', e);
  }
}
