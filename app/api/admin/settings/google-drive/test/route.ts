import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { normalizeDriveFolderId, testDriveFolder } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ folderId: z.string().trim().min(1) });

/** POST /api/admin/settings/google-drive/test — verify the configured folder is writable. */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const data = bodySchema.parse(await request.json());
    const folderId = normalizeDriveFolderId(data.folderId);
    if (!folderId) return fail('Enter a Google Drive folder URL or ID', 400);

    const existing = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    if (!existing?.googleDriveRefreshToken) return fail('Connect Google Drive first.', 400);

    const folder = await testDriveFolder(folderId);
    const updated = await prisma.setting.update({
      where: { id: 'singleton' },
      data: {
        googleDriveFolderId: folder.id,
        googleDriveFolderName: folder.name,
        googleDriveLastTestAt: new Date(),
      },
    });
    await audit(session.email, 'settings.google_drive.test', 'singleton', { folderId: folder.id });
    return ok({
      folderId: updated.googleDriveFolderId,
      folderName: updated.googleDriveFolderName,
      lastTestAt: updated.googleDriveLastTestAt?.toISOString() ?? null,
      connectedEmail: updated.googleDriveConnectedEmail,
    });
  } catch (err) {
    return handleError(err);
  }
}
