import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError, fail } from '@/lib/http';

export const dynamic = 'force-dynamic';

const permissionsSchema = z.record(z.string(), z.enum(['none', 'read', 'edit'])).default({});

const createSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
  role: z.enum(['admin', 'staff']).default('staff'),
  permissions: permissionsSchema,
});

/** GET /api/admin/users — list all admin users. */
export async function GET() {
  try {
    await requirePermission('settingsUsers', 'read');
    const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return ok({
      users: users.map((u) => ({ id: u.id, email: u.email, role: u.role, permissions: u.permissions, createdAt: u.createdAt.toISOString() })),
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/admin/users — create a new admin user.
 * A staff user granted settingsUsers:edit can create/manage other staff
 * accounts, but only a true admin can create another admin account.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('settingsUsers', 'edit');
    const { email, password, role, permissions } = createSchema.parse(await request.json());
    if (role === 'admin' && session.role !== 'admin') {
      return fail('Only an admin can create another admin account.', 403);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.adminUser.create({ data: { email, passwordHash, role, permissions } });
    await audit(session.email, 'user.create', user.email, { role });
    return ok({ user: { id: user.id, email: user.email, role: user.role, permissions: user.permissions } }, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return fail('A user with that email already exists.', 409);
    }
    return handleError(err);
  }
}
