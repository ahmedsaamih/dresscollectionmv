import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

const prefSchema = z.object({
  event: z.string().min(1),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
});
const bodySchema = z.object({ prefs: z.array(prefSchema).min(1) });

/** GET /api/admin/settings/notification-prefs — all per-event channel toggles. */
export async function GET() {
  try {
    await requirePermission('settingsGeneral', 'read');
    const prefs = await prisma.notificationChannelPref.findMany({ orderBy: { event: 'asc' } });
    return ok({ prefs });
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH /api/admin/settings/notification-prefs — bulk upsert per-event channel toggles. */
export async function PATCH(request: Request) {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const data = bodySchema.parse(await request.json());

    const prefs = await prisma.$transaction(
      data.prefs.map(p => prisma.notificationChannelPref.upsert({
        where: { event: p.event },
        create: { event: p.event, emailEnabled: p.emailEnabled, smsEnabled: p.smsEnabled },
        update: { emailEnabled: p.emailEnabled, smsEnabled: p.smsEnabled },
      }))
    );
    await audit(session.email, 'settings.notification_prefs.update', 'singleton', { events: data.prefs.map(p => p.event) });
    return ok({ prefs });
  } catch (err) {
    return handleError(err);
  }
}
