import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { hasPermission, type ModuleKey, type Permissions } from '@/lib/permissions';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  role: z.enum(['admin', 'staff']).optional(),
  permissions: z.record(z.string(), z.enum(['none', 'read', 'edit'])).optional(),
  password: z.string().min(8).optional(),
}).strict();

/**
 * PATCH /api/admin/users/[id] — update role, permissions, and/or password.
 * A staff user granted settingsUsers:edit can manage other staff accounts,
 * but can never touch an admin account, grant the admin role, or grant a
 * higher permission level than they themselves hold for a module.
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('settingsUsers', 'edit');
    const data = updateSchema.parse(await request.json());

    const target = await prisma.adminUser.findUnique({ where: { id: params.id } });
    if (!target) return fail('User not found', 404);

    if (session.role !== 'admin') {
      if (target.role === 'admin') return fail("Only an admin can modify another admin's account.", 403);
      if (data.role === 'admin') return fail('Only an admin can grant the admin role.', 403);
      if (data.permissions) {
        for (const [mod, level] of Object.entries(data.permissions)) {
          if (level !== 'none' && !hasPermission(session, mod as ModuleKey, level)) {
            return fail(`You can't grant a higher permission than you hold for ${mod}.`, 403);
          }
        }
      }
    }

    const update: Prisma.AdminUserUpdateInput = {};
    if (data.role !== undefined) update.role = data.role;
    if (data.permissions !== undefined) update.permissions = data.permissions as Permissions;
    if (data.password !== undefined) update.passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.adminUser.update({ where: { id: params.id }, data: update });
    await audit(session.email, 'user.update', user.email, { keys: Object.keys(data) });
    return ok({ user: { id: user.id, email: user.email, role: user.role, permissions: user.permissions } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('User not found', 404);
    }
    return handleError(err);
  }
}

/** DELETE /api/admin/users/[id] — delete a user (cannot delete yourself, or an admin unless you are one). */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('settingsUsers', 'edit');
    const target = await prisma.adminUser.findUnique({ where: { id: params.id } });
    if (!target) return fail('User not found', 404);
    if (target.email === session.email) return fail("You can't delete your own account.", 400);
    if (target.role === 'admin' && session.role !== 'admin') {
      return fail("Only an admin can delete another admin's account.", 403);
    }
    await prisma.adminUser.delete({ where: { id: params.id } });
    await audit(session.email, 'user.delete', target.email);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
