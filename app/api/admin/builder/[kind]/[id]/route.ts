import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { builderSchemas } from '@/lib/validation';
import { builderModel, isBuilderKind } from '@/lib/builder-models';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/builder/[kind]/[id]. */
export async function PATCH(request: Request, props: { params: Promise<{ kind: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('builder', 'edit');
    const { kind, id } = params;
    if (!isBuilderKind(kind)) return fail('Unknown builder option', 404);

    const data = builderSchemas[kind].parse(await request.json());
    const { delegate } = builderModel(kind);

    const old = await delegate().findUnique({ where: { id } });
    const updated = await delegate().update({ where: { id }, data });

    // Cascade label/name renames to product string arrays
    if (old) {
      const d = data as Record<string, unknown>;
      if (kind === 'sleeves') {
        const oldLabel = old.label as string, newLabel = d.label as string;
        if (oldLabel !== newLabel) {
          await prisma.$executeRaw`UPDATE "Product" SET sleeves = array_replace(sleeves, ${oldLabel}, ${newLabel}) WHERE ${oldLabel} = ANY(sleeves)`;
          await prisma.$executeRaw`UPDATE "Product" SET "sleeveImages" = ("sleeveImages" - ${oldLabel}) || jsonb_build_object(${newLabel}, "sleeveImages"->>${oldLabel}) WHERE "sleeveImages" ? ${oldLabel}`;
          await prisma.$executeRaw`UPDATE "Product" SET "sleeveAdjustments" = ("sleeveAdjustments" - ${oldLabel}) || jsonb_build_object(${newLabel}, ("sleeveAdjustments"->>${oldLabel})::int) WHERE "sleeveAdjustments" ? ${oldLabel}`;
        }
      } else if (kind === 'necks') {
        const oldLabel = old.label as string, newLabel = d.label as string;
        if (oldLabel !== newLabel)
          await prisma.$executeRaw`UPDATE "Product" SET necks = array_replace(necks, ${oldLabel}, ${newLabel}) WHERE ${oldLabel} = ANY(necks)`;
      } else if (kind === 'colors') {
        const oldName = old.name as string, newName = d.name as string;
        if (oldName !== newName) {
          await prisma.$executeRaw`UPDATE "Product" SET colors = array_replace(colors, ${oldName}, ${newName}) WHERE ${oldName} = ANY(colors)`;
          await prisma.$executeRaw`UPDATE "Product" SET "colorImages" = ("colorImages" - ${oldName}) || jsonb_build_object(${newName}, "colorImages"->>${oldName}) WHERE "colorImages" ? ${oldName}`;
          // Rekey live Inventory rows too — historical StockTransfer/StockAdjustment audit rows are left untouched by design.
          await prisma.$executeRaw`UPDATE "Inventory" SET color = ${newName} WHERE color = ${oldName}`;
        }
      } else if (kind === 'sizes') {
        const oldLabel = old.label as string, newLabel = d.label as string;
        if (oldLabel !== newLabel) {
          await prisma.$executeRaw`UPDATE "Product" SET sizes = array_replace(sizes, ${oldLabel}, ${newLabel}) WHERE ${oldLabel} = ANY(sizes)`;
          await prisma.$executeRaw`UPDATE "Product" SET "sizeStock" = ("sizeStock" - ${oldLabel}) || jsonb_build_object(${newLabel}, ("sizeStock"->>${oldLabel})::int) WHERE "sizeStock" ? ${oldLabel}`;
          await prisma.$executeRaw`UPDATE "Product" SET "sizeAdjustments" = ("sizeAdjustments" - ${oldLabel}) || jsonb_build_object(${newLabel}, ("sizeAdjustments"->>${oldLabel})::int) WHERE "sizeAdjustments" ? ${oldLabel}`;
          // Rekey live Inventory rows too — historical StockTransfer/StockAdjustment audit rows are left untouched by design.
          await prisma.$executeRaw`UPDATE "Inventory" SET size = ${newLabel} WHERE size = ${oldLabel}`;
        }
      }
    }

    await audit(session.email, `builder.${kind}.update`, id, data);
    return ok({ item: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Option not found', 404);
    }
    return handleError(err);
  }
}

/** DELETE /api/admin/builder/[kind]/[id]. */
export async function DELETE(
  _request: Request,
  props: { params: Promise<{ kind: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await requirePermission('builder', 'edit');
    const { kind, id } = params;
    if (!isBuilderKind(kind)) return fail('Unknown builder option', 404);

    const { delegate } = builderModel(kind);
    await delegate().delete({ where: { id } });
    await audit(session.email, `builder.${kind}.delete`, id);
    return ok({ deleted: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Option not found', 404);
    }
    return handleError(err);
  }
}
