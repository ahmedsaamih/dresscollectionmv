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
/** `mobile`/`smsAllowed`: the caller's canSendSms() check result — kept out of this layer so lib/notify never needs a Request object. */
export interface QuoteRequestedEvent { ref: string; email: string; name: string; mobile: string | null; smsAllowed: boolean }
export interface AdminQuoteAlertEvent { ref: string; customer: string; units: number }
export interface AdminOrderAlertEvent { ref: string; customer: string; total: number; itemCount: number }
export interface QuotePricedEvent { ref: string; email: string; price: number; mobile: string | null; smsAllowed: boolean }
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
}

/** Fired when an admin sends a priced quote's confirm/reject link to the customer. */
export interface QuoteConfirmationRequestedEvent {
  ref: string;
  email: string;
  name: string;
  price: number;
  mobile: string | null;
  smsAllowed: boolean;
  confirmUrl: string;
  ttlDays: number;
}

/** Fired when the customer confirms or declines a quote via the confirmation link. */
export interface QuoteDecisionEvent {
  ref: string;
  email: string;
  name: string;
  mobile: string | null;
  smsAllowed: boolean;
}

export interface AdminQuoteStageAlertEvent { ref: string; customer: string; fromStage: number; toStage: number }
export interface AdminOrderStageAlertEvent { ref: string; customer: string; fromStage: number; toStage: number }
export interface AdminOrderPaymentAlertEvent { ref: string; customer: string; total: number }

export interface Notifier {
  orderPlaced(o: OrderPlacedEvent): Promise<void>;
  orderPaymentConfirmed(o: OrderPaymentConfirmedEvent): Promise<void>;
  quoteRequested(q: QuoteRequestedEvent): Promise<void>;
  adminQuoteAlert(q: AdminQuoteAlertEvent): Promise<void>;
  adminOrderAlert(o: AdminOrderAlertEvent): Promise<void>;
  quotePriced(q: QuotePricedEvent): Promise<void>;
  orderStatusUpdated(o: OrderStatusEvent): Promise<void>;
  reviewRequested(o: OrderReviewRequestEvent): Promise<void>;
  quoteConfirmationRequested(q: QuoteConfirmationRequestedEvent): Promise<void>;
  quoteConfirmed(q: QuoteDecisionEvent): Promise<void>;
  quoteRejected(q: QuoteDecisionEvent): Promise<void>;
  adminQuoteStageAlert(e: AdminQuoteStageAlertEvent): Promise<void>;
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
