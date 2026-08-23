// Human-readable labels for the 4 customer-facing notification events, keyed
// by the Notifier interface's method names — the same keys used by
// NotificationChannelPref.event (see prisma/schema.prisma). Shared between
// the admin Settings UI and (if ever needed) server-side validation, so the
// label set can't drift from the actual event keys.

export const ORDER_NOTIFICATION_EVENTS = ['orderPlaced', 'orderPaymentConfirmed', 'orderStatusUpdated', 'reviewRequested'] as const;

export const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  orderPlaced: 'Order placed',
  orderPaymentConfirmed: 'Payment confirmed',
  orderStatusUpdated: 'Order status changed',
  reviewRequested: 'Review requested',
};
