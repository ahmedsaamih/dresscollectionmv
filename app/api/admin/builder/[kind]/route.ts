import { builderSchemas } from '@/lib/validation';
import { builderModel, isBuilderKind } from '@/lib/builder-models';
import { requirePermission, audit, genId } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** POST /api/admin/builder/[kind] — add a builder option. */
export async function POST(request: Request, props: { params: Promise<{ kind: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('builder', 'edit');
    const { kind } = params;
    if (!isBuilderKind(kind)) return fail('Unknown builder option', 404);

    const data = builderSchemas[kind].parse(await request.json());
    const { delegate, prefix } = builderModel(kind);
    const id = genId(prefix);

    const created = await delegate().create({ data: { id, ...data } });
    await audit(session.email, `builder.${kind}.create`, id, data);
    return ok({ item: created }, 201);
  } catch (err) {
    return handleError(err);
  }
}
