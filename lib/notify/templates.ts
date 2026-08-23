import { formatMVR, ORDER_STAGES } from '@/lib/utils';
import type {
  EmailContent,
  OrderPlacedEvent,
  OrderPaymentConfirmedEvent,
  AdminOrderAlertEvent,
  OrderStatusEvent,
  OrderReviewRequestEvent,
  AdminOrderStageAlertEvent,
  AdminOrderPaymentAlertEvent,
} from './types';

const STORE_NAME = 'Dress Collection';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const ROSE = '#db5795';
const INK = '#200c15';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/**
 * Minimal branded shell. Inline styles only — email clients ignore <style>.
 * `heading`/`bodyHtml` are trusted HTML the templates assemble; any user input
 * inside them must already be passed through esc().
 */
function shell(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#080808;font-family:Arial,Helvetica,sans-serif;color:#ffe9f3">
  <div style="max-width:540px;margin:0 auto;padding:32px 24px">
    <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:${ROSE};font-weight:bold">${STORE_NAME}</div>
    <h1 style="font-size:22px;margin:14px 0 18px">${heading}</h1>
    <div style="background:${INK};border:1px solid rgba(193,57,120,.3);border-radius:14px;padding:22px;font-size:14px;line-height:1.6">${bodyHtml}</div>
    <p style="font-size:11px;color:#855f71;margin-top:22px">${STORE_NAME} · Malé, Maldives · This is an automated message.</p>
  </div></body></html>`;
}

function refBlock(label: string, ref: string): string {
  return `<div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#907481">${label}</div>
  <div style="font-size:26px;font-weight:bold;color:${ROSE};margin-top:4px">${esc(ref)}</div>`;
}

function statusLink(ref: string): string {
  return `<p style="margin:16px 0 0"><a href="${APP_URL}/status?ref=${encodeURIComponent(ref)}" style="color:${ROSE}">Track it on our status page →</a></p>`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function orderPlaced(o: OrderPlacedEvent): EmailContent {
  const html = shell(`Order received, ${esc(o.name)}`,
    `${refBlock('Order reference', o.ref)}
     <p style="margin:16px 0 0">Thanks for your order. Total <strong>${esc(formatMVR(o.total))}</strong>.
     We'll confirm once your bank transfer is received, or you can pay on pickup.</p>${statusLink(o.ref)}`);
  const text = `Order received, ${o.name}\nReference: ${o.ref}\nTotal: ${formatMVR(o.total)}\nWe'll confirm once payment is received. Track: ${APP_URL}/status`;
  return { subject: `Your ${STORE_NAME} order ${o.ref}`, html, text };
}

export function orderPlacedSms(o: OrderPlacedEvent): string {
  return `${STORE_NAME}: order ${o.ref} placed. Track: ${APP_URL}/status?ref=${encodeURIComponent(o.ref)}`;
}

export function orderPaymentConfirmedSms(o: OrderPaymentConfirmedEvent): string {
  return `${STORE_NAME}: payment confirmed for order ${o.ref}. Track: ${APP_URL}/status?ref=${encodeURIComponent(o.ref)}`;
}

export function orderPaymentConfirmed(o: OrderPaymentConfirmedEvent): EmailContent {
  const html = shell(`Payment confirmed, ${esc(o.name)}`,
    `${refBlock('Order reference', o.ref)}
     <p style="margin:16px 0 0">We've confirmed your payment. Your order is now moving into production/fulfilment.</p>${statusLink(o.ref)}`);
  const text = `Order ${o.ref} payment confirmed\nTrack: ${APP_URL}/status`;
  return { subject: `${STORE_NAME} order ${o.ref} — payment confirmed`, html, text };
}

export function adminOrderAlertText(o: AdminOrderAlertEvent): string {
  return `New order\nReference: ${o.ref}\nCustomer: ${o.customer}\nTotal: ${formatMVR(o.total)}\nItems: ${o.itemCount}\nAdmin: ${APP_URL}/admin`;
}

export function orderStatusUpdated(o: OrderStatusEvent): EmailContent {
  const stageLabel = ORDER_STAGES[o.stage] ?? `Stage ${o.stage}`;
  const html = shell(`Order update, ${esc(o.name)}`,
    `${refBlock('Order reference', o.ref)}
     <p style="margin:16px 0 0">Status: <strong style="color:${ROSE}">${esc(stageLabel)}</strong>.</p>${statusLink(o.ref)}`);
  const text = `Order ${o.ref} update\nStatus: ${stageLabel}\nTrack: ${APP_URL}/status`;
  return { subject: `${STORE_NAME} order ${o.ref} — ${stageLabel}`, html, text };
}

export function orderStatusUpdatedSms(o: OrderStatusEvent): string {
  const stageLabel = ORDER_STAGES[o.stage] ?? `Stage ${o.stage}`;
  return `${STORE_NAME}: order ${o.ref} update — ${stageLabel}. Track: ${APP_URL}/status?ref=${encodeURIComponent(o.ref)}`;
}

export function orderReviewRequest(o: OrderReviewRequestEvent): EmailContent {
  const html = shell(`How was your order, ${esc(o.name)}?`,
    `${refBlock('Order reference', o.ref)}
     <p style="margin:16px 0 0">We'd love to hear what you thought. Leave a quick review — it only takes a minute.</p>
     <p style="margin:20px 0 0"><a href="${esc(o.reviewUrl)}" style="display:inline-block;background:${ROSE};color:#200612;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">Leave a review →</a></p>
     <p style="margin:16px 0 0;font-size:12px;color:#907481">This link expires in 3 days.</p>`);
  const text = `How was your order, ${o.name}?\nReference: ${o.ref}\nLeave a review: ${o.reviewUrl}\nThis link expires in 3 days.`;
  return { subject: `How was your ${STORE_NAME} order, ${o.name}?`, html, text };
}

export function orderReviewRequestSms(o: OrderReviewRequestEvent): string {
  return `${STORE_NAME}: how was order ${o.ref}? Leave a quick review: ${o.reviewUrl} (expires in 3 days)`;
}

export function adminOrderStageAlertText(e: AdminOrderStageAlertEvent): string {
  const from = ORDER_STAGES[e.fromStage] ?? `Stage ${e.fromStage}`;
  const to = ORDER_STAGES[e.toStage] ?? `Stage ${e.toStage}`;
  return `Order stage changed\nReference: ${e.ref}\nCustomer: ${e.customer}\n${from} → ${to}\nAdmin: ${APP_URL}/admin`;
}

export function adminOrderPaymentAlertText(e: AdminOrderPaymentAlertEvent): string {
  return `Order payment confirmed\nReference: ${e.ref}\nCustomer: ${e.customer}\nTotal: ${formatMVR(e.total)}\nAdmin: ${APP_URL}/admin`;
}
