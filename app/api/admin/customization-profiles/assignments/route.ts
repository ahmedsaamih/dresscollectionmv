import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

const assignmentSchema = z.object({
  profileId: z.string().trim().optional().default(''),
  scope: z.enum(['collection', 'category', 'product']),
  collectionKey: z.string().trim().nullish(),
  categoryId: z.string().trim().nullish(),
  productId: z.string().trim().nullish(),
}).superRefine((data, ctx) => {
  if (data.scope === 'collection' && !data.collectionKey) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['collectionKey'], message: 'Collection is required' });
  if (data.scope === 'category' && !data.categoryId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categoryId'], message: 'Category is required' });
  if (data.scope === 'product' && !data.productId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['productId'], message: 'Product is required' });
});

export async function POST(request: Request) {
  try {
    const session = await requirePermission('customization', 'edit');
    const data = assignmentSchema.parse(await request.json());
    const where = data.scope === 'collection'
      ? { scope: data.scope, collectionKey: data.collectionKey }
      : data.scope === 'category'
        ? { scope: data.scope, categoryId: data.categoryId }
        : { scope: data.scope, productId: data.productId };

    await prisma.$transaction(async (tx) => {
      await tx.customizationProfileAssignment.deleteMany({ where });
      if (data.profileId) {
        await tx.customizationProfileAssignment.create({
          data: {
            profileId: data.profileId,
            scope: data.scope,
            collectionKey: data.scope === 'collection' ? data.collectionKey ?? null : null,
            categoryId: data.scope === 'category' ? data.categoryId ?? null : null,
            productId: data.scope === 'product' ? data.productId ?? null : null,
          },
        });
      }
    });

    await audit(session.email, 'customizationProfile.assign', data.profileId || 'none', data);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
