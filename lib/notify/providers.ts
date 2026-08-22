import type { EmailProvider, EmailMessage, SmsProvider, SmsMessage, AdminAlertProvider, SendResult } from './types';

/** Dev/default email channel — logs instead of sending. */
export class NoopEmailProvider implements EmailProvider {
  readonly name = 'noop';
  async send(msg: EmailMessage): Promise<void> {
    console.log(`[notify:email:noop] → ${msg.to} · ${msg.subject}`);
  }
}

/**
 * Resend transactional email (https://resend.com/docs/api-reference/emails/send-email).
 * Activated by EMAIL_DRIVER=resend + a Resend API key — a single secret,
 * unlike Mailjet's public/private pair. Auth is a Bearer token.
 * Throws on failure so the composite notifier can log it; it never propagates
 * to the request handler.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private endpoint = 'https://api.resend.com/emails';

  constructor(
    private apiKey: string,
    private from: string,
    private fromName?: string,
  ) {}

  async send(msg: EmailMessage): Promise<SendResult> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.fromName ? `${this.fromName} <${this.from}>` : this.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    const json = await res.json().catch(() => ({}) as { id?: string });
    if (!res.ok) {
      throw new Error(`Resend send failed (${res.status}): ${JSON.stringify(json).slice(0, 200)}`);
    }
    return { providerMessageId: json.id };
  }
}

/** Dev/default SMS channel — logs instead of sending. */
export class NoopSmsProvider implements SmsProvider {
  readonly name = 'noop';
  readonly available = true;
  async send(msg: SmsMessage): Promise<void> {
    console.log(`[notify:sms:noop] → ${msg.to} · ${msg.text}`);
  }
}

/**
 * MsgOwl transactional SMS (https://www.msgowl.com/docs).
 * Activated by SMS_DRIVER=msgowl + MSGOWL_API_KEY + MSGOWL_SENDER_ID. Throws
 * on failure so the composite notifier can log it; it never propagates to
 * the request handler.
 */
export class MsgOwlSmsProvider implements SmsProvider {
  readonly name = 'msgowl';
  readonly available = true;
  private endpoint = 'https://rest.msgowl.com/messages';

  constructor(
    private apiKey: string,
    private senderId: string,
  ) {}

  async send(msg: SmsMessage): Promise<SendResult> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `AccessKey ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: msg.to,
        sender_id: this.senderId,
        body: msg.text,
      }),
    });
    const json = await res.json().catch(() => ({}) as { message?: string; id?: string | number; retry_after?: number });
    if (!res.ok) {
      const detail = json.message ?? '';
      const retryAfter = res.status === 429 && json.retry_after ? ` (retry after ${json.retry_after}s)` : '';
      throw new Error(`MsgOwl send failed (${res.status}): ${detail}${retryAfter}`);
    }
    return { providerMessageId: json.id !== undefined ? String(json.id) : undefined };
  }
}

/** Dev/default admin-alert channel — logs instead of sending. */
export class NoopAdminAlertProvider implements AdminAlertProvider {
  readonly name = 'noop';
  readonly available = true;
  async send(text: string): Promise<void> {
    console.log(`[notify:alert:noop] → ${text}`);
  }
}

/**
 * Telegram Bot API (https://core.telegram.org/bots/api#sendmessage).
 * Activated by ADMIN_ALERT_DRIVER=telegram + TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.
 * Throws on failure so the composite notifier can log it; it never propagates
 * to the request handler.
 */
export class TelegramAdminAlertProvider implements AdminAlertProvider {
  readonly name = 'telegram';
  readonly available = true;
  private endpoint: string;

  constructor(botToken: string, private chatId: string) {
    this.endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  }

  async send(text: string): Promise<void> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Telegram send failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  }
}
