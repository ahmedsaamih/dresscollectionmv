// Notification contracts. Events are channel-agnostic; the composite notifier
// fans each one out to the configured email provider (and, later, SMS).

export interface OrderPlacedEvent {
  ref: string;
  email: string;
  name: string;
  total: number;
  mobile: string | null;
  /** Result of the caller's canSendSms() check — kept out of this layer so
   * lib/notify never needs a Request object. */
  smsAllowed: boolean;
}
export interface AdminOrderAlertEvent { ref: string; customer: string; total: number; itemCount: number }
export interface OrderStatusEvent { ref: string; email: string; name: string; stage: number; mobile: string | null; smsAllowed: boolean }
export interface OrderReviewRequestEvent { ref: string; email: string; name: string; reviewUrl: string; mobile: string | null; smsAllowed: boolean }

/**
 * Fired when an order's `paid` flag transitions to true — at web-checkout
 * time this is never at creation (payment is confirmed later by an admin);
 * at POS it can be immediate (paid in full at the counter) or later.
 */
export interface OrderPaymentConfirmedEvent {
  ref: string;
  email: string;
  name: string;
  mobile: string | null;
  /** Result of the caller's canSendSms() check — kept out of this layer so
   * lib/notify never needs a Request object. */
  smsAllowed: boolean;
  /** > 0 for a pre-order — this confirms the deposit only, a balance remains. */
  balanceDue?: number;
}

/** Fired when a pre-order's remaining balance (after the deposit) is confirmed received. */
export interface OrderBalanceConfirmedEvent {
  ref: string;
  email: string;
  name: string;
  mobile: string | null;
  smsAllowed: boolean;
}

export interface AdminOrderStageAlertEvent { ref: string; customer: string; fromStage: number; toStage: number }
export interface AdminOrderPaymentAlertEvent { ref: string; customer: string; total: number; auto?: boolean }

export interface Notifier {
  orderPlaced(o: OrderPlacedEvent): Promise<void>;
  orderPaymentConfirmed(o: OrderPaymentConfirmedEvent): Promise<void>;
  orderBalanceConfirmed(o: OrderBalanceConfirmedEvent): Promise<void>;
  adminOrderAlert(o: AdminOrderAlertEvent): Promise<void>;
  orderStatusUpdated(o: OrderStatusEvent): Promise<void>;
  reviewRequested(o: OrderReviewRequestEvent): Promise<void>;
  adminOrderStageAlert(e: AdminOrderStageAlertEvent): Promise<void>;
  adminOrderPaymentAlert(e: AdminOrderPaymentAlertEvent): Promise<void>;
}

// ─── Channel providers ───────────────────────────────────────────────────────

export interface EmailContent { subject: string; html: string; text: string }
export interface EmailMessage extends EmailContent { to: string }

export interface SendResult { providerMessageId?: string }

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<SendResult | void>;
}

export interface SmsMessage { to: string; text: string }

export interface SmsProvider {
  readonly name: string;
  /** Whether this channel is configured to actually deliver. */
  readonly available: boolean;
  send(msg: SmsMessage): Promise<SendResult | void>;
}

/** Admin-facing alert channel (currently Telegram) — plain text, no HTML. */
export interface AdminAlertProvider {
  readonly name: string;
  readonly available: boolean;
  send(text: string): Promise<SendResult | void>;
}
