import type {
  Notifier,
  EmailProvider,
  EmailContent,
  SmsProvider,
  AdminAlertProvider,
  OrderPlacedEvent,
  OrderPaymentConfirmedEvent,
  QuoteRequestedEvent,
  AdminQuoteAlertEvent,
  AdminOrderAlertEvent,
  QuotePricedEvent,
  OrderStatusEvent,
  OrderReviewRequestEvent,
  QuoteConfirmationRequestedEvent,
  QuoteDecisionEvent,
  AdminQuoteStageAlertEvent,
  AdminOrderStageAlertEvent,
  AdminOrderPaymentAlertEvent,
} from './types';
import { NoopEmailProvider, ResendEmailProvider, NoopSmsProvider, MsgOwlSmsProvider, NoopAdminAlertProvider, TelegramAdminAlertProvider } from './providers';
import * as templates from './templates';
import { logNotification } from './log';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';

export type { Notifier } from './types';

/** Env-configured fallback, used only until an admin email is saved via Admin → Settings. */
const ADMIN_EMAIL_FALLBACK = process.env.ADMIN_EMAIL || 'admin@dresscollectionmv.com';

/**
 * Env-configured fallback, used only until credentials are saved via
 * Admin → Settings. Resend has no prior env-var usage in this codebase, so
 * this resolves to noop unless RESEND_API_KEY/EMAIL_SENDING_DOMAIN/
 * EMAIL_FROM_USER are explicitly set.
 */
function makeEnvEmailProvider(): EmailProvider {
  const driver = (process.env.EMAIL_DRIVER || 'noop').toLowerCase();
  if (driver === 'resend') {
    const key = process.env.RESEND_API_KEY;
    const domain = process.env.EMAIL_SENDING_DOMAIN;
    const user = process.env.EMAIL_FROM_USER;
    if (key && domain && user) return new ResendEmailProvider(key, `${user}@${domain}`, process.env.EMAIL_FROM_NAME);
    console.warn('[notify] EMAIL_DRIVER=resend but Resend env vars are incomplete — using noop email until configured via Admin → Settings.');
  }
  return new NoopEmailProvider();
}

/** Env-configured fallback, used only until credentials are saved via Admin → Settings. */
function makeEnvSmsProvider(): SmsProvider {
  const driver = (process.env.SMS_DRIVER || 'noop').toLowerCase();
  if (driver === 'msgowl') {
    const key = process.env.MSGOWL_API_KEY;
    const senderId = process.env.MSGOWL_SENDER_ID;
    if (key && senderId) return new MsgOwlSmsProvider(key, senderId);
    console.warn('[notify] SMS_DRIVER=msgowl but MSGOWL_API_KEY/MSGOWL_SENDER_ID is unset — using noop sms.');
  }
  return new NoopSmsProvider();
}

function makeAdminAlertProvider(): AdminAlertProvider {
  const driver = (process.env.ADMIN_ALERT_DRIVER || 'noop').toLowerCase();
  if (driver === 'telegram') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) return new TelegramAdminAlertProvider(token, chatId);
    console.warn('[notify] ADMIN_ALERT_DRIVER=telegram but TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID is unset — using noop admin alert.');
  }
  return new NoopAdminAlertProvider();
}

/**
 * Fans notification events out to the configured channels. Email (Resend)
 * and SMS (MsgOwl) are resolved fresh from the database on every send, so the
 * Settings-page cards take effect immediately without a redeploy. Delivery
 * is best-effort — failures are logged, never thrown, so they cannot break the
 * order/quote write path that awaits them.
 */
class CompositeNotifier implements Notifier {
  constructor(
    /** Env-configured fallback, used only until credentials are saved via Admin → Settings. */
    private envEmail: EmailProvider,
    /** Env-configured fallback, used only until credentials are saved via Admin → Settings. */
    private envSms: SmsProvider,
    /** Env-configured fallback, used only until a bot token is saved via Admin → Settings. */
    private envAlert: AdminAlertProvider,
  ) {}

  /**
   * Resolves the email channel fresh on every send (not cached at startup)
   * so the Settings-page Resend card takes effect immediately. Once a key
   * has been saved to the database it is the sole source of truth (the
   * enabled toggle is honored literally, with no env fallback) — until then,
   * EMAIL_DRIVER and friends keep working exactly as before.
   */
  private async resolveEmailProvider(): Promise<EmailProvider> {
    try {
      const setting = await prisma.setting.findUnique({ where: { id: 'singleton' } });
      if (setting?.emailApiKey) {
        if (!setting.emailAlertsEnabled) return new NoopEmailProvider();
        const from = `${setting.emailFromUser}@${process.env.EMAIL_SENDING_DOMAIN ?? ''}`;
        return new ResendEmailProvider(decryptSecret(setting.emailApiKey), from, setting.emailFromName || undefined);
      }
    } catch (e) {
      console.error('[notify] failed to resolve DB-configured Resend email provider, falling back to env', e);
    }
    return this.envEmail;
  }

  /**
   * Resolves the SMS channel fresh on every send, mirroring resolveEmailProvider.
   * Once a key has been saved to the database it is the sole source of truth
   * — until then, SMS_DRIVER/MSGOWL_API_KEY/MSGOWL_SENDER_ID keep working
   * exactly as before.
   */
  private async resolveSmsProvider(): Promise<SmsProvider> {
    try {
      const setting = await prisma.setting.findUnique({ where: { id: 'singleton' } });
      if (setting?.msgowlApiKey) {
        if (!setting.smsAlertsEnabled) return new NoopSmsProvider();
        return new MsgOwlSmsProvider(decryptSecret(setting.msgowlApiKey), setting.msgowlSenderId);
      }
    } catch (e) {
      console.error('[notify] failed to resolve DB-configured MsgOwl SMS provider, falling back to env', e);
    }
    return this.envSms;
  }

  private async resolveAlertProvider(): Promise<AdminAlertProvider> {
    try {
      const setting = await prisma.setting.findUnique({ where: { id: 'singleton' } });
      if (setting?.telegramBotToken) {
        if (!setting.telegramAlertsEnabled || !setting.telegramChatId) return new NoopAdminAlertProvider();
        return new TelegramAdminAlertProvider(decryptSecret(setting.telegramBotToken), setting.telegramChatId);
      }
    } catch (e) {
      console.error('[notify] failed to resolve DB-configured Telegram alert provider, falling back to env', e);
    }
    return this.envAlert;
  }

  /** Resolves the "new quote" admin-alert recipient fresh on every send, mirroring the other resolvers. */
  private async resolveAdminEmail(): Promise<string> {
    try {
      const setting = await prisma.setting.findUnique({ where: { id: 'singleton' } });
      if (setting?.adminEmail) return setting.adminEmail;
    } catch (e) {
      console.error('[notify] failed to resolve DB-configured admin email, falling back to env', e);
    }
    return ADMIN_EMAIL_FALLBACK;
  }

  /**
   * Per-event Email/SMS toggle, configured from Admin → Settings → Notification
   * preferences. Fails open (both channels enabled) when no row exists yet or
   * on any DB error, so a pref-table hiccup can't silently suppress a message
   * the provider layer would otherwise have sent.
   */
  private async resolveChannelPref(event: string): Promise<{ email: boolean; sms: boolean }> {
    try {
      const pref = await prisma.notificationChannelPref.findUnique({ where: { event } });
      if (!pref) return { email: true, sms: true };
      return { email: pref.emailEnabled, sms: pref.smsEnabled };
    } catch (e) {
      console.error(`[notify] failed to resolve channel pref for ${event}, defaulting to enabled`, e);
      return { email: true, sms: true };
    }
  }

  private async sendEmail(email: EmailProvider, to: string, content: EmailContent, ctx: { event: string; orderRef?: string }): Promise<void> {
    if (!to) return;
    try {
      const result = await email.send({ to, ...content });
      await logNotification({
        channel: 'email', event: ctx.event, orderRef: ctx.orderRef, recipient: to,
        provider: email.name, providerMessageId: result?.providerMessageId,
        status: email.name === 'noop' ? 'skipped' : 'sent',
      });
    } catch (e) {
      console.error(`[notify] email send failed (${email.name}) → ${to}`, e);
      await logNotification({
        channel: 'email', event: ctx.event, orderRef: ctx.orderRef, recipient: to,
        provider: email.name, status: 'failed', error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async sendSms(sms: SmsProvider, to: string, text: string, ctx: { event: string; orderRef?: string }): Promise<void> {
    try {
      const result = await sms.send({ to, text });
      await logNotification({
        channel: 'sms', event: ctx.event, orderRef: ctx.orderRef, recipient: to,
        provider: sms.name, providerMessageId: result?.providerMessageId,
        status: sms.name === 'noop' ? 'skipped' : 'sent',
      });
    } catch (e) {
      console.error(`[notify] sms send failed (${sms.name}) → ${to}`, e);
      await logNotification({
        channel: 'sms', event: ctx.event, orderRef: ctx.orderRef, recipient: to,
        provider: sms.name, status: 'failed', error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async sendAlert(text: string, ctx: { event: string; orderRef?: string }): Promise<void> {
    const alert = await this.resolveAlertProvider();
    try {
      const result = await alert.send(text);
      await logNotification({
        channel: 'telegram', event: ctx.event, orderRef: ctx.orderRef, recipient: 'admin',
        provider: alert.name, providerMessageId: result?.providerMessageId,
        status: alert.name === 'noop' ? 'skipped' : 'sent',
      });
    } catch (e) {
      console.error(`[notify] admin alert send failed (${alert.name})`, e);
      await logNotification({
        channel: 'telegram', event: ctx.event, orderRef: ctx.orderRef, recipient: 'admin',
        provider: alert.name, status: 'failed', error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async orderPlaced(o: OrderPlacedEvent) {
    const pref = await this.resolveChannelPref('orderPlaced');
    if (pref.email) {
      const email = await this.resolveEmailProvider();
      await this.sendEmail(email, o.email, templates.orderPlaced(o), { event: 'order.placed', orderRef: o.ref });
    }
    if (pref.sms) {
      const sms = await this.resolveSmsProvider();
      if (sms.available && o.mobile && o.smsAllowed) {
        await this.sendSms(sms, o.mobile, templates.orderPlacedSms(o), { event: 'order.placed', orderRef: o.ref });
      }
    }
  }

  /** Fired once an order's payment is confirmed, not at placement. */
  async orderPaymentConfirmed(o: OrderPaymentConfirmedEvent) {
    const pref = await this.resolveChannelPref('orderPaymentConfirmed');
    if (pref.email) {
      const email = await this.resolveEmailProvider();
      await this.sendEmail(email, o.email, templates.orderPaymentConfirmed(o), { event: 'order.payment_confirmed', orderRef: o.ref });
    }
    if (pref.sms) {
      const sms = await this.resolveSmsProvider();
      if (sms.available && o.mobile && o.smsAllowed) {
        await this.sendSms(sms, o.mobile, templates.orderPaymentConfirmedSms(o), { event: 'order.payment_confirmed', orderRef: o.ref });
      }
    }
  }

  async quoteRequested(q: QuoteRequestedEvent) {
    const pref = await this.resolveChannelPref('quoteRequested');
    if (pref.email) {
      const email = await this.resolveEmailProvider();
      await this.sendEmail(email, q.email, templates.quoteRequested(q), { event: 'quote.requested', orderRef: q.ref });
    }
    if (pref.sms) {
      const sms = await this.resolveSmsProvider();
      if (sms.available && q.mobile && q.smsAllowed) {
        await this.sendSms(sms, q.mobile, templates.quoteRequestedSms(q), { event: 'quote.requested', orderRef: q.ref });
      }
    }
  }

  async adminQuoteAlert(q: AdminQuoteAlertEvent) {
    const adminEmail = await this.resolveAdminEmail();
    const email = await this.resolveEmailProvider();
    await this.sendEmail(email, adminEmail, templates.adminQuoteAlert(q), { event: 'quote.admin_alert', orderRef: q.ref });
    await this.sendAlert(templates.adminQuoteAlert(q).text, { event: 'quote.admin_alert', orderRef: q.ref });
  }

  async adminOrderAlert(o: AdminOrderAlertEvent) {
    await this.sendAlert(templates.adminOrderAlertText(o), { event: 'order.admin_alert', orderRef: o.ref });
  }

  async quotePriced(q: QuotePricedEvent) {
    const pref = await this.resolveChannelPref('quotePriced');
    if (pref.email) {
      const email = await this.resolveEmailProvider();
      await this.sendEmail(email, q.email, templates.quotePriced(q), { event: 'quote.priced', orderRef: q.ref });
    }
    if (pref.sms) {
      const sms = await this.resolveSmsProvider();
      if (sms.available && q.mobile && q.smsAllowed) {
        await this.sendSms(sms, q.mobile, templates.quotePricedSms(q), { event: 'quote.priced', orderRef: q.ref });
      }
    }
  }

  async orderStatusUpdated(o: OrderStatusEvent) {
    const pref = await this.resolveChannelPref('orderStatusUpdated');
    if (pref.email) {
      const email = await this.resolveEmailProvider();
      await this.sendEmail(email, o.email, templates.orderStatusUpdated(o), { event: 'order.status', orderRef: o.ref });
    }
    if (pref.sms) {
      const sms = await this.resolveSmsProvider();
      if (sms.available && o.mobile && o.smsAllowed) {
        await this.sendSms(sms, o.mobile, templates.orderStatusUpdatedSms(o), { event: 'order.status', orderRef: o.ref });
      }
    }
  }

  async reviewRequested(o: OrderReviewRequestEvent) {
    const pref = await this.resolveChannelPref('reviewRequested');
    if (pref.email) {
      const email = await this.resolveEmailProvider();
      await this.sendEmail(email, o.email, templates.orderReviewRequest(o), { event: 'order.review_requested', orderRef: o.ref });
    }
    if (pref.sms) {
      const sms = await this.resolveSmsProvider();
      if (sms.available && o.mobile && o.smsAllowed) {
        await this.sendSms(sms, o.mobile, templates.orderReviewRequestSms(o), { event: 'order.review_requested', orderRef: o.ref });
      }
    }
  }

  /** Fired when an admin sends a priced quote's confirm/reject link to the customer. */
  async quoteConfirmationRequested(q: QuoteConfirmationRequestedEvent) {
    const pref = await this.resolveChannelPref('quoteConfirmationRequested');
    if (pref.email) {
      const email = await this.resolveEmailProvider();
      await this.sendEmail(email, q.email, templates.quoteConfirmationRequested(q), { event: 'quote.confirmation_requested', orderRef: q.ref });
    }
    if (pref.sms) {
      const sms = await this.resolveSmsProvider();
      if (sms.available && q.mobile && q.smsAllowed) {
        await this.sendSms(sms, q.mobile, templates.quoteConfirmationRequestedSms(q), { event: 'quote.confirmation_requested', orderRef: q.ref });
      }
    }
    await this.sendAlert(templates.adminQuoteConfirmationSentAlertText(q), { event: 'quote.admin_alert.confirmation_sent', orderRef: q.ref });
  }

  async quoteConfirmed(q: QuoteDecisionEvent) {
    const pref = await this.resolveChannelPref('quoteConfirmed');
    if (pref.email) {
      const email = await this.resolveEmailProvider();
      await this.sendEmail(email, q.email, templates.quoteConfirmed(q), { event: 'quote.confirmed', orderRef: q.ref });
    }
    if (pref.sms) {
      const sms = await this.resolveSmsProvider();
      if (sms.available && q.mobile && q.smsAllowed) {
        await this.sendSms(sms, q.mobile, templates.quoteConfirmedSms(q), { event: 'quote.confirmed', orderRef: q.ref });
      }
    }
    await this.sendAlert(templates.adminQuoteDecisionAlertText(q, 'confirmed'), { event: 'quote.admin_alert.decision', orderRef: q.ref });
  }

  async quoteRejected(q: QuoteDecisionEvent) {
    const pref = await this.resolveChannelPref('quoteRejected');
    if (pref.email) {
      const email = await this.resolveEmailProvider();
      await this.sendEmail(email, q.email, templates.quoteRejected(q), { event: 'quote.rejected', orderRef: q.ref });
    }
    if (pref.sms) {
      const sms = await this.resolveSmsProvider();
      if (sms.available && q.mobile && q.smsAllowed) {
        await this.sendSms(sms, q.mobile, templates.quoteRejectedSms(q), { event: 'quote.rejected', orderRef: q.ref });
      }
    }
    await this.sendAlert(templates.adminQuoteDecisionAlertText(q, 'rejected'), { event: 'quote.admin_alert.decision', orderRef: q.ref });
  }

  /** Telegram-only — admin visibility into stage/payment transitions, not customer-facing. */
  async adminQuoteStageAlert(e: AdminQuoteStageAlertEvent) {
    await this.sendAlert(templates.adminQuoteStageAlertText(e), { event: 'quote.admin_alert.stage', orderRef: e.ref });
  }

  async adminOrderStageAlert(e: AdminOrderStageAlertEvent) {
    await this.sendAlert(templates.adminOrderStageAlertText(e), { event: 'order.admin_alert.stage', orderRef: e.ref });
  }

  async adminOrderPaymentAlert(e: AdminOrderPaymentAlertEvent) {
    await this.sendAlert(templates.adminOrderPaymentAlertText(e), { event: 'order.admin_alert.payment', orderRef: e.ref });
  }
}

export const notifier: Notifier = new CompositeNotifier(makeEnvEmailProvider(), makeEnvSmsProvider(), makeAdminAlertProvider());
