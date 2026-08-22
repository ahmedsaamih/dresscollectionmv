import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { settingsUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { normalizeDriveFolderId } from '@/lib/google-drive';
import { normalizeStorefrontCopy } from '@/lib/storefront-copy';

export const dynamic = 'force-dynamic';

function toSettings(s: NonNullable<Awaited<ReturnType<typeof prisma.setting.findUnique>>>) {
  return {
    storeName: s.storeName, tagline: s.tagline, email: s.email, adminEmail: s.adminEmail, phone: s.phone, address: s.address,
    bank: s.bank, bankAccounts: s.bankAccounts ?? [], builderFields: s.builderFields ?? [], currency: s.currency,
    pickupEnabled: s.pickupEnabled, deliveryFee: s.deliveryFee,
    heroTitle: s.heroTitle, heroSub: s.heroSub, heroImage: s.heroImage, heroImages: (s.heroImages as string[] | null) ?? [], workshopImage: s.workshopImage, categoryReadyImage: s.categoryReadyImage, categoryCustomImage: s.categoryCustomImage, categoryCasualImage: s.categoryCasualImage, categoryAccessoriesImage: s.categoryAccessoriesImage,
    customizationGuidePdfUrl: s.customizationGuidePdfUrl, customizationTemplateXlsxUrl: s.customizationTemplateXlsxUrl,
    storefrontCopy: normalizeStorefrontCopy(s.storefrontCopy),
    taxId: s.taxId, taxRate: s.taxRate, taxLabel: s.taxLabel, termsConditions: s.termsConditions,
    googleDriveUploadsEnabled: s.googleDriveUploadsEnabled,
    googleDriveFolderId: s.googleDriveFolderId,
    googleDriveFolderName: s.googleDriveFolderName,
    googleDriveLastTestAt: s.googleDriveLastTestAt?.toISOString() ?? null,
    googleDriveConnectedEmail: s.googleDriveConnectedEmail,
    // telegramBotToken is never sent to the client — telegramConnected is a
    // derived boolean so the UI can show connection state without the secret.
    telegramConnected: !!s.telegramBotToken,
    telegramChatId: s.telegramChatId,
    telegramBotUsername: s.telegramBotUsername,
    telegramAlertsEnabled: s.telegramAlertsEnabled,
    telegramLastTestAt: s.telegramLastTestAt?.toISOString() ?? null,
    // The Resend key is never sent to the client — emailConnected is a
    // derived boolean so the UI can show connection state without the secret.
    emailConnected: !!s.emailApiKey,
    emailFromUser: s.emailFromUser,
    emailFromName: s.emailFromName,
    emailAlertsEnabled: s.emailAlertsEnabled,
    emailLastTestAt: s.emailLastTestAt?.toISOString() ?? null,
    // msgowlApiKey is never sent to the client — smsConnected is a derived
    // boolean so the UI can show connection state without the secret.
    smsConnected: !!s.msgowlApiKey,
    msgowlSenderId: s.msgowlSenderId,
    smsAlertsEnabled: s.smsAlertsEnabled,
    smsLastTestAt: s.smsLastTestAt?.toISOString() ?? null,
  };
}

/** GET /api/admin/settings. */
export async function GET() {
  try {
    await requirePermission('settingsGeneral', 'read');
    const s = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    if (!s) return fail('Store is not configured', 500);
    return ok({ settings: toSettings(s) });
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH /api/admin/settings — partial update of the singleton settings row. */
export async function PATCH(request: Request) {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const data = settingsUpdateSchema.parse(await request.json());
    if (data.googleDriveFolderId !== undefined) {
      data.googleDriveFolderId = normalizeDriveFolderId(data.googleDriveFolderId);
    }

    const current = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    if (!current) return fail('Store is not configured', 500);
    const emailAlertsEnabled = data.emailAlertsEnabled ?? current.emailAlertsEnabled;
    const emailFromUser = data.emailFromUser ?? current.emailFromUser;
    if (emailAlertsEnabled && !emailFromUser) {
      return fail('Set a "from" address before enabling email alerts.', 400);
    }
    const smsAlertsEnabled = data.smsAlertsEnabled ?? current.smsAlertsEnabled;
    const msgowlSenderId = data.msgowlSenderId ?? current.msgowlSenderId;
    if (smsAlertsEnabled && !msgowlSenderId) {
      return fail('Set a MsgOwl sender ID before enabling SMS alerts.', 400);
    }

    const updated = await prisma.setting.update({ where: { id: 'singleton' }, data: data as Prisma.SettingUpdateInput });
    await audit(session.email, 'settings.update', 'singleton', { keys: Object.keys(data) });
    return ok({ settings: toSettings(updated) });
  } catch (err) {
    return handleError(err);
  }
}
