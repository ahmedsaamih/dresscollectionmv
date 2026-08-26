import { PDFDocument, PDFPage, PDFFont, PDFImage, StandardFonts, rgb } from 'pdf-lib';
import { RECEIPT_LOGO_DATA_URI } from '@/lib/receipt-logo';

// ─── Colors ──────────────────────────────────────────────────────────────────
const INK   = rgb(0.10, 0.10, 0.10);
const GRAY  = rgb(0.50, 0.50, 0.50);
const LGRAY = rgb(0.93, 0.93, 0.93);
const TBHDR = rgb(0.13, 0.13, 0.13);
const WHITE = rgb(1.00, 1.00, 1.00);

// ─── Page constants ───────────────────────────────────────────────────────────
const PW  = 595;
const PH  = 842;
const ML  = 50;   // left margin
const MR  = 545;  // right margin edge

// ─── Table column right-align edges ──────────────────────────────────────────
const COL_NUM_X  = ML + 3;   // # column left text
const COL_DESC_X = 79;       // Item column left text
const COL_QTY_R  = 387;      // Qty right-align x
const COL_RATE_R = 457;      // Rate right-align x
const COL_AMT_R  = MR - 3;   // Amount right-align x

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return 'MVR ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── PDF context ─────────────────────────────────────────────────────────────
interface Ctx {
  doc: PDFDocument;
  pages: PDFPage[];
  page: PDFPage;
  y: number;
  r: PDFFont;
  b: PDFFont;
  o: PDFFont;
}

async function mkCtx(): Promise<Ctx> {
  const doc = await PDFDocument.create();
  const [r, b, o] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
  ]);
  const page = doc.addPage([PW, PH]);
  return { doc, pages: [page], page, y: PH - 40, r, b, o };
}

function addPage(ctx: Ctx): void {
  const p = ctx.doc.addPage([PW, PH]);
  ctx.pages.push(p);
  ctx.page = p;
  ctx.y = PH - 40;
}

function need(ctx: Ctx, h: number): void {
  if (ctx.y - h < 60) addPage(ctx);
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────
function rAlign(page: PDFPage, text: string, rx: number, y: number, sz: number, f: PDFFont, c = INK) {
  page.drawText(text, { x: rx - f.widthOfTextAtSize(text, sz), y, size: sz, font: f, color: c });
}

function cAlign(page: PDFPage, text: string, x1: number, x2: number, y: number, sz: number, f: PDFFont, c = INK) {
  const w = f.widthOfTextAtSize(text, sz);
  page.drawText(text, { x: x1 + (x2 - x1 - w) / 2, y, size: sz, font: f, color: c });
}

function hLine(page: PDFPage, y: number, x1 = ML, x2 = MR) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: LGRAY });
}

function wrapText(text: string, f: PDFFont, sz: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let cur = '';
    for (const word of para.split(' ')) {
      if (!word) continue;
      const test = cur ? `${cur} ${word}` : word;
      if (f.widthOfTextAtSize(test, sz) <= maxW) {
        cur = test;
      } else {
        if (cur) out.push(cur);
        cur = word;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function addFooters(ctx: Ctx) {
  ctx.pages.forEach((p, i) => cAlign(p, String(i + 1), 0, PW, 22, 9, ctx.r, GRAY));
}

// ─── Shared header (Order Confirmation) ──────────────────────────────────────
function drawDocHeader(
  ctx: Ctx,
  logo: PDFImage,
  docType: string,
  refLine: string,
  balanceLabel: string | null,
  balanceAmt: string | null,
  store: { name: string; address: string; phone: string; email: string; taxId: string },
): void {
  const { page, b, r } = ctx;
  const LOGO = 90;
  const logoBottomY = PH - 40 - LOGO; // 712

  // Logo — top-left
  page.drawImage(logo, { x: ML, y: logoBottomY, width: LOGO, height: LOGO });

  // Company info — left side, below logo
  let cy = logoBottomY - 16;
  page.drawText(store.name, { x: ML, y: cy, size: 11, font: b, color: INK });
  cy -= 15;
  if (store.address) {
    page.drawText(store.address, { x: ML, y: cy, size: 9, font: r, color: GRAY });
    cy -= 13;
  }
  const contactLine = [store.phone, store.email].filter(Boolean).join('  ·  ');
  if (contactLine) {
    page.drawText(contactLine, { x: ML, y: cy, size: 9, font: r, color: GRAY });
    cy -= 13;
  }
  if (store.taxId) {
    page.drawText(`Tax ID: ${store.taxId}`, { x: ML, y: cy, size: 9, font: r, color: GRAY });
    cy -= 13;
  }

  // Doc type / ref / balance — right side
  const titleY = PH - 40 - 28; // baseline of doc type title (e.g. "Order Confirmation")
  rAlign(page, docType, MR, titleY, 28, b, INK);
  rAlign(page, refLine, MR, titleY - 24, 11, r, GRAY);
  if (balanceLabel && balanceAmt) {
    rAlign(page, balanceLabel, MR, titleY - 54, 9, r, GRAY);
    rAlign(page, balanceAmt, MR, titleY - 74, 20, b, INK);
  }

  // Full-width HR below header
  const hrY = Math.min(cy - 8, 636);
  hLine(page, hrY);
  ctx.y = hrY - 18;
}

// ─── Bill To + meta block (Order Confirmation) ───────────────────────────────
function drawBillTo(
  ctx: Ctx,
  customer: string,
  email: string | null | undefined,
  mobile: string | null | undefined,
  rightPairs: [string, string][],
): void {
  const { page, b, r } = ctx;
  const startY = ctx.y;

  // Left: Bill To
  page.drawText('Bill To', { x: ML, y: startY, size: 9, font: r, color: GRAY });
  page.drawText(customer, { x: ML, y: startY - 15, size: 11, font: b, color: INK });
  let lY = startY - 30;
  if (email) { page.drawText(email, { x: ML, y: lY, size: 9, font: r, color: GRAY }); lY -= 13; }
  if (mobile) { page.drawText(mobile, { x: ML, y: lY, size: 9, font: r, color: GRAY }); lY -= 13; }

  // Right: date / terms pairs
  let rY = startY;
  for (const [label, value] of rightPairs) {
    page.drawText(label, { x: 315, y: rY, size: 9, font: r, color: GRAY });
    rAlign(page, value, MR, rY, 9, b, INK);
    rY -= 16;
  }

  ctx.y = Math.min(lY, rY) - 14;
}

// ─── Items table header ───────────────────────────────────────────────────────
const ROW_H = 22;

function drawTableHeader(ctx: Ctx): void {
  need(ctx, ROW_H + 4);
  const rowY = ctx.y - ROW_H;
  ctx.page.drawRectangle({ x: ML, y: rowY, width: MR - ML, height: ROW_H, color: TBHDR });
  const ty = rowY + 7;
  ctx.page.drawText('#', { x: COL_NUM_X, y: ty, size: 9, font: ctx.b, color: WHITE });
  ctx.page.drawText('Item & Description', { x: COL_DESC_X, y: ty, size: 9, font: ctx.b, color: WHITE });
  rAlign(ctx.page, 'Qty',    COL_QTY_R,  ty, 9, ctx.b, WHITE);
  rAlign(ctx.page, 'Rate',   COL_RATE_R, ty, 9, ctx.b, WHITE);
  rAlign(ctx.page, 'Amount', COL_AMT_R,  ty, 9, ctx.b, WHITE);
  ctx.y = rowY;
}

// ─── Totals block (right-aligned) ────────────────────────────────────────────
function drawTotals(
  ctx: Ctx,
  subtotal: number,
  deliveryFee: number,
  discount: number,
  taxRate: number,
  taxLabel: string,
  showBalanceDue: boolean,
): void {
  const { page, b, r } = ctx;
  const LBL_R = 447;
  const VAL_R = MR - 3;

  const taxableBase = subtotal + deliveryFee - discount;
  const taxAmt = taxRate > 0 ? Math.round(taxableBase * taxRate / 100) : 0;
  const total = taxableBase + taxAmt;

  const row = (label: string, value: string, bold = false) => {
    need(ctx, 16);
    ctx.y -= 14;
    rAlign(page, label, LBL_R, ctx.y, 9, bold ? b : r, bold ? INK : GRAY);
    rAlign(page, value, VAL_R, ctx.y, 9, bold ? b : r, INK);
  };

  ctx.y -= 8;
  row('Sub Total', fmt(subtotal));
  if (deliveryFee > 0) {
    row('Delivery', fmt(deliveryFee));
  }
  if (discount > 0) {
    const discountBase = subtotal + deliveryFee;
    const pct = discountBase > 0 ? (discount / discountBase * 100).toFixed(2) : '0.00';
    row(`Discount (${pct}%)`, `(−) ${fmt(discount)}`);
  }
  if (taxAmt > 0) {
    row(`${taxLabel} (${taxRate}%)`, fmt(taxAmt));
  }

  ctx.y -= 6;
  hLine(page, ctx.y, 290, MR);
  ctx.y -= 4;

  need(ctx, 16);
  ctx.y -= 14;
  rAlign(page, 'Total', LBL_R, ctx.y, 10, b, INK);
  rAlign(page, fmt(total), VAL_R, ctx.y, 10, b, INK);

  if (showBalanceDue) {
    need(ctx, 16);
    ctx.y -= 14;
    rAlign(page, 'Balance Due', LBL_R, ctx.y, 10, b, INK);
    rAlign(page, fmt(total), VAL_R, ctx.y, 10, b, INK);
  }
}

// ─── Text section (Notes / Terms) ────────────────────────────────────────────
function drawTextSection(ctx: Ctx, title: string, body: string | null | undefined): void {
  if (!body?.trim()) return;
  need(ctx, 32);
  ctx.y -= 22;
  ctx.page.drawText(title, { x: ML, y: ctx.y, size: 11, font: ctx.b, color: INK });
  ctx.y -= 14;
  for (const line of wrapText(body, ctx.r, 9, MR - ML)) {
    if (line === '') { ctx.y -= 7; continue; }
    need(ctx, 14);
    ctx.page.drawText(line, { x: ML, y: ctx.y, size: 9, font: ctx.r, color: GRAY });
    ctx.y -= 12;
  }
}

// ─── Load logo bytes (cached) ─────────────────────────────────────────────────
// Base64-embedded (lib/receipt-logo.ts), same source used by the payment-receipt
// image generator — avoids a runtime disk read of public/mm-logo.jpg, which
// doesn't exist in this deployment and was silently failing every order confirmation PDF.
let _logoBytes: Uint8Array | null = null;
function getLogoBytes(): Uint8Array {
  if (!_logoBytes) {
    const base64 = RECEIPT_LOGO_DATA_URI.slice(RECEIPT_LOGO_DATA_URI.indexOf(',') + 1);
    _logoBytes = new Uint8Array(Buffer.from(base64, 'base64'));
  }
  return _logoBytes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PUBLIC INTERFACES ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrderConfirmationPdfData {
  ref: string;
  customer: string;
  email: string;
  mobile?: string | null;
  date: string;
  method: string;
  address?: string | null;
  notes?: string | null;
  subtotal: number;
  deliveryFee?: number;
  discount: number;
  total: number;
  items: { name: string; qty: number; price: number; size: string; color: string }[];
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  taxId: string;
  bankAccounts: { name: string; accountNumber: string }[];
  taxRate: number;
  taxLabel: string;
  termsConditions: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── orderConfirmationPdf (Order Confirmation) ───────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function orderConfirmationPdf(d: OrderConfirmationPdfData): Promise<Buffer> {
  const ctx = await mkCtx();
  const logo = await ctx.doc.embedPng(getLogoBytes());

  drawDocHeader(
    ctx, logo,
    'Order Confirmation', `# ${d.ref}`,
    'Balance Due', fmt(d.total),
    { name: d.storeName, address: d.storeAddress, phone: d.storePhone, email: d.storeEmail, taxId: d.taxId },
  );

  drawBillTo(ctx, d.customer, d.email, d.mobile, [
    ['Order Date', d.date],
  ]);

  drawTableHeader(ctx);

  d.items.forEach((item, idx) => {
    const rowHeight = ROW_H;
    need(ctx, rowHeight);
    const rowY = ctx.y - rowHeight;
    if (idx % 2 === 1) {
      ctx.page.drawRectangle({ x: ML, y: rowY, width: MR - ML, height: rowHeight, color: LGRAY });
    }
    const ty = rowY + rowHeight - ROW_H + 7;
    const meta = [item.size, item.color].filter(Boolean).join(' · ');
    const label = meta ? `${item.name} (${meta})` : item.name;
    ctx.page.drawText(String(idx + 1), { x: COL_NUM_X,  y: ty, size: 9, font: ctx.r, color: INK });
    ctx.page.drawText(label,           { x: COL_DESC_X, y: ty, size: 9, font: ctx.r, color: INK });
    rAlign(ctx.page, String(item.qty),          COL_QTY_R,  ty, 9, ctx.r);
    rAlign(ctx.page, fmt(item.price),            COL_RATE_R, ty, 9, ctx.r);
    rAlign(ctx.page, fmt(item.price * item.qty), COL_AMT_R,  ty, 9, ctx.r);

    ctx.y = rowY;
  });

  drawTotals(ctx, d.subtotal, d.deliveryFee ?? 0, d.discount, d.taxRate, d.taxLabel, true);
  drawTextSection(ctx, 'Notes', d.notes);

  let tc = d.termsConditions;
  if (d.bankAccounts.length > 0) {
    const bankLines = d.bankAccounts.map(a => `${a.name}: ${a.accountNumber}`).join('\n');
    tc = tc ? `${tc}\n\nBank Accounts:\n${bankLines}` : `Bank Accounts:\n${bankLines}`;
  }
  drawTextSection(ctx, 'Terms & Conditions', tc);

  addFooters(ctx);
  return Buffer.from(await ctx.doc.save());
}

