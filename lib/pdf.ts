import { PDFDocument, PDFPage, PDFFont, PDFImage, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

// ─── Colors ──────────────────────────────────────────────────────────────────
const INK   = rgb(0.10, 0.10, 0.10);
const GRAY  = rgb(0.50, 0.50, 0.50);
const LGRAY = rgb(0.93, 0.93, 0.93);
const TBHDR = rgb(0.13, 0.13, 0.13);
const WHITE = rgb(1.00, 1.00, 1.00);
const GREEN = rgb(0.42, 0.68, 0.26);

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

// ─── Shared header (Invoice / Quotation) ─────────────────────────────────────
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
  const titleY = PH - 40 - 28; // baseline of doc type title (e.g. "Invoice")
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

// ─── Bill To + meta block (Invoice / Quotation) ───────────────────────────────
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
// IMPORTANT: fs.readFileSync returns a pooled Buffer whose .buffer is the entire
// Node.js pool, not just the JPEG slice. pdf-lib's JpegEmbedder does
// new DataView(imageData.buffer) and reads from offset 0 of that ArrayBuffer,
// missing the actual JPEG data. Copy into a standalone Uint8Array first.
let _logoBytes: Uint8Array | null = null;
function getLogoBytes(): Uint8Array {
  if (!_logoBytes) {
    const raw = fs.readFileSync(path.join(process.cwd(), 'public', 'mm-logo.jpg'));
    _logoBytes = new Uint8Array(raw);
  }
  return _logoBytes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PUBLIC INTERFACES ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export interface InvoicePdfData {
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
  items: { name: string; qty: number; price: number; size: string; color: string; sleeve?: string; neck?: string; customizationNote?: string; customizationLines?: { label: string; cost: number }[] }[];
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

export interface QuotationPdfData {
  ref: string;
  customer: string;
  email?: string | null;
  mobile?: string | null;
  date: string;
  message?: string | null;
  items: { name: string; specs: string; units: number; sizesLabel: string; unitPrice: number; customizationLines?: { label: string; cost: number }[]; customizationCost?: number }[];
  price: number;
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

export interface PaymentReceiptPdfData {
  orderRef: string;
  customer: string;
  paymentDate: string;
  paymentMode: string;
  referenceNumber: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  amount: number;
  invoiceDate: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  taxId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── orderConfirmationPdf (Invoice) ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function orderConfirmationPdf(d: InvoicePdfData): Promise<Buffer> {
  const ctx = await mkCtx();
  const logo = await ctx.doc.embedJpg(getLogoBytes());

  drawDocHeader(
    ctx, logo,
    'Invoice', `# ${d.ref}`,
    'Balance Due', fmt(d.total),
    { name: d.storeName, address: d.storeAddress, phone: d.storePhone, email: d.storeEmail, taxId: d.taxId },
  );

  drawBillTo(ctx, d.customer, d.email, d.mobile, [
    ['Invoice Date', d.date],
    ['Terms', 'Due on Receipt'],
    ['Due Date', d.date],
  ]);

  drawTableHeader(ctx);

  d.items.forEach((item, idx) => {
    const custLines = item.customizationLines ?? [];
    const custTotal = custLines.reduce((s, l) => s + l.cost, 0);
    const hasNote = !!item.customizationNote?.trim();
    const rowHeight = ROW_H + ((hasNote ? 1 : 0) + custLines.length) * 11;
    need(ctx, rowHeight);
    const rowY = ctx.y - rowHeight;
    if (idx % 2 === 1) {
      ctx.page.drawRectangle({ x: ML, y: rowY, width: MR - ML, height: rowHeight, color: LGRAY });
    }
    const ty = rowY + rowHeight - ROW_H + 7;
    const meta = [item.size, item.color, item.sleeve, item.neck].filter(Boolean).join(' · ');
    const label = meta ? `${item.name} (${meta})` : item.name;
    ctx.page.drawText(String(idx + 1), { x: COL_NUM_X,  y: ty, size: 9, font: ctx.r, color: INK });
    ctx.page.drawText(label,           { x: COL_DESC_X, y: ty, size: 9, font: ctx.r, color: INK });
    rAlign(ctx.page, String(item.qty),          COL_QTY_R,  ty, 9, ctx.r);
    rAlign(ctx.page, fmt(item.price),            COL_RATE_R, ty, 9, ctx.r);
    rAlign(ctx.page, fmt(item.price * item.qty + custTotal), COL_AMT_R,  ty, 9, ctx.r);

    let subY = ty;
    if (hasNote) {
      subY -= 11;
      ctx.page.drawText(item.customizationNote!, { x: COL_DESC_X, y: subY, size: 8, font: ctx.o, color: GRAY });
    }
    for (const l of custLines) {
      subY -= 11;
      ctx.page.drawText(l.label, { x: COL_DESC_X, y: subY, size: 8, font: ctx.o, color: GRAY });
      rAlign(ctx.page, `+${fmt(l.cost)}`, COL_AMT_R, subY, 8, ctx.r, GRAY);
    }

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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── quotationPdf (Priced Quotation sent by admin) ───────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function quotationPdf(d: QuotationPdfData): Promise<Buffer> {
  const ctx = await mkCtx();
  const logo = await ctx.doc.embedJpg(getLogoBytes());

  const taxAmt = d.taxRate > 0 ? Math.round(d.price * d.taxRate / 100) : 0;
  const grandTotal = d.price + taxAmt;

  drawDocHeader(
    ctx, logo,
    'Quotation', `# ${d.ref}`,
    null, null,
    { name: d.storeName, address: d.storeAddress, phone: d.storePhone, email: d.storeEmail, taxId: d.taxId },
  );

  drawBillTo(ctx, d.customer, d.email, d.mobile, [['Estimate Date', d.date]]);

  // Subject line (message/description)
  if (d.message?.trim()) {
    const { page, r, b } = ctx;
    need(ctx, 24);
    ctx.y -= 10;
    page.drawText('Subject:', { x: ML, y: ctx.y, size: 9, font: b, color: INK });
    page.drawText(d.message.slice(0, 200), { x: ML + 55, y: ctx.y, size: 9, font: r, color: GRAY });
    ctx.y -= 16;
  }

  drawTableHeader(ctx);

  d.items.forEach((item, idx) => {
    const custLines = item.customizationLines ?? [];
    const custTotal = item.customizationCost ?? custLines.reduce((s, l) => s + l.cost, 0);
    const itemAmt = item.unitPrice * item.units + custTotal;
    const hasDesc = !!item.specs?.trim();
    const rowHeight = ROW_H + ((hasDesc ? 1 : 0) + custLines.length) * 11;
    need(ctx, rowHeight);
    const rowY = ctx.y - rowHeight;
    if (idx % 2 === 1) {
      ctx.page.drawRectangle({ x: ML, y: rowY, width: MR - ML, height: rowHeight, color: LGRAY });
    }
    const ty = rowY + rowHeight - ROW_H + 7; // top text line
    ctx.page.drawText(String(idx + 1), { x: COL_NUM_X,  y: ty, size: 9, font: ctx.r, color: INK });
    ctx.page.drawText(item.name,        { x: COL_DESC_X, y: ty, size: 9, font: ctx.b, color: INK });
    rAlign(ctx.page, String(item.units),   COL_QTY_R,  ty, 9, ctx.r);
    rAlign(ctx.page, fmt(item.unitPrice),  COL_RATE_R, ty, 9, ctx.r);
    rAlign(ctx.page, fmt(itemAmt),         COL_AMT_R,  ty, 9, ctx.r);

    let subY = ty;
    if (hasDesc) {
      subY -= 11;
      ctx.page.drawText(item.specs, { x: COL_DESC_X, y: subY, size: 8, font: ctx.o, color: GRAY });
    }
    for (const l of custLines) {
      subY -= 11;
      ctx.page.drawText(l.label, { x: COL_DESC_X, y: subY, size: 8, font: ctx.o, color: GRAY });
      rAlign(ctx.page, `+${fmt(l.cost)}`, COL_AMT_R, subY, 8, ctx.r, GRAY);
    }

    ctx.y = rowY;
  });

  // Totals (no Balance Due on quotation)
  const LBL_R = 447;
  const VAL_R = MR - 3;
  ctx.y -= 8;
  need(ctx, 14);
  ctx.y -= 14;
  rAlign(ctx.page, 'Sub Total', LBL_R, ctx.y, 9, ctx.r, GRAY);
  rAlign(ctx.page, fmt(d.price), VAL_R, ctx.y, 9, ctx.r, INK);
  if (taxAmt > 0) {
    need(ctx, 14);
    ctx.y -= 14;
    rAlign(ctx.page, `${d.taxLabel} (${d.taxRate}%)`, LBL_R, ctx.y, 9, ctx.r, GRAY);
    rAlign(ctx.page, fmt(taxAmt), VAL_R, ctx.y, 9, ctx.r, INK);
  }
  ctx.y -= 6;
  hLine(ctx.page, ctx.y, 290, MR);
  ctx.y -= 4;
  need(ctx, 16);
  ctx.y -= 14;
  rAlign(ctx.page, 'Total', LBL_R, ctx.y, 10, ctx.b, INK);
  rAlign(ctx.page, fmt(grandTotal), VAL_R, ctx.y, 10, ctx.b, INK);

  drawTextSection(ctx, 'Notes', d.message);

  let tc = d.termsConditions;
  if (d.bankAccounts.length > 0) {
    const bankLines = d.bankAccounts.map(a => `${a.name}: ${a.accountNumber}`).join('\n');
    tc = tc ? `${tc}\n\nBank Accounts:\n${bankLines}` : `Bank Accounts:\n${bankLines}`;
  }
  drawTextSection(ctx, 'Terms & Conditions', tc);

  addFooters(ctx);
  return Buffer.from(await ctx.doc.save());
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── paymentReceiptPdf ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function paymentReceiptPdf(d: PaymentReceiptPdfData): Promise<Buffer> {
  const ctx = await mkCtx();
  const logo = await ctx.doc.embedJpg(getLogoBytes());
  const { page, b, r } = ctx;

  // ── Header: large logo left, company info right ──────────────────────────────
  const LOGO = 150;
  const logoY = PH - 40 - LOGO; // 652
  page.drawImage(logo, { x: ML, y: logoY, width: LOGO, height: LOGO });

  const infoX = ML + LOGO + 20; // 220
  let cy = PH - 40 - 14;
  page.drawText(d.storeName, { x: infoX, y: cy, size: 16, font: b, color: INK });
  cy -= 20;
  if (d.storeAddress) { page.drawText(d.storeAddress, { x: infoX, y: cy, size: 9, font: r, color: GRAY }); cy -= 14; }
  const contactLine = [d.storePhone, d.storeEmail].filter(Boolean).join('  ·  ');
  if (contactLine) { page.drawText(contactLine, { x: infoX, y: cy, size: 9, font: r, color: GRAY }); cy -= 14; }
  if (d.taxId) { page.drawText(`Tax ID: ${d.taxId}`, { x: infoX, y: cy, size: 9, font: r, color: GRAY }); }

  // ── Full-width HR ─────────────────────────────────────────────────────────────
  const hrY = logoY - 16;
  hLine(page, hrY);
  ctx.y = hrY - 22;

  // ── "PAYMENT RECEIPT" title ───────────────────────────────────────────────────
  // Spaced title — manually insert thin spaces for tracking effect
  const title = 'P A Y M E N T   R E C E I P T';
  const titleW = b.widthOfTextAtSize(title, 15);
  page.drawText(title, { x: ML + (MR - ML - titleW) / 2, y: ctx.y, size: 15, font: b, color: INK });
  ctx.y -= 28;

  // ── Two-column info block ─────────────────────────────────────────────────────
  const COL_MID = ML + Math.floor((MR - ML) * 0.55); // ~322
  const LEFT_W = COL_MID - ML - 10;

  // Left: payment meta
  const leftPairs: [string, string][] = [
    ['Payment Date',      d.paymentDate],
    ['Reference Number',  d.referenceNumber],
    ['Payment Mode',      d.paymentMode],
  ];
  let leftY = ctx.y;
  for (const [label, value] of leftPairs) {
    page.drawText(label, { x: ML, y: leftY, size: 9, font: r, color: GRAY });
    leftY -= 14;
    page.drawText(value, { x: ML, y: leftY, size: 11, font: b, color: INK });
    leftY -= 20;
  }

  // Right: green amount box
  const BOX_X = COL_MID + 10;
  const BOX_W = MR - BOX_X;
  const BOX_H = 80;
  const boxY = ctx.y - BOX_H;
  page.drawRectangle({ x: BOX_X, y: boxY, width: BOX_W, height: BOX_H, color: GREEN });
  page.drawText('Amount Received', { x: BOX_X + 12, y: boxY + BOX_H - 22, size: 9, font: r, color: WHITE });
  const amtText = fmt(d.amount);
  const amtSz = 16;
  const amtW = b.widthOfTextAtSize(amtText, amtSz);
  page.drawText(amtText, { x: BOX_X + (BOX_W - amtW) / 2, y: boxY + 22, size: amtSz, font: b, color: WHITE });

  ctx.y = Math.min(leftY, boxY) - 20;

  // ── Received From ─────────────────────────────────────────────────────────────
  page.drawText('Received From', { x: ML, y: ctx.y, size: 9, font: r, color: GRAY });
  ctx.y -= 15;
  page.drawText(d.customer, { x: ML, y: ctx.y, size: 12, font: b, color: INK });
  ctx.y -= 20;

  // ── HR ────────────────────────────────────────────────────────────────────────
  hLine(page, ctx.y);
  ctx.y -= 20;

  // ── Breakdown (Product subtotal / Delivery / Discount) ───────────────────────
  // amount is the full order total; break it down so a discounted or
  // delivery-inclusive order doesn't collapse to a single opaque figure.
  const bRow = (label: string, value: string, bold = false) => {
    page.drawText(label, { x: ML, y: ctx.y, size: 9, font: bold ? b : r, color: bold ? INK : GRAY });
    rAlign(page, value, MR, ctx.y, 9, bold ? b : r, INK);
    ctx.y -= 14;
  };
  bRow('Product Subtotal', fmt(d.subtotal));
  if (d.deliveryFee > 0) bRow('Delivery', fmt(d.deliveryFee));
  if (d.discount > 0) bRow('Discount', `(−) ${fmt(d.discount)}`);
  ctx.y -= 10;

  // ── "Payment for" table ───────────────────────────────────────────────────────
  page.drawText('Payment for', { x: ML, y: ctx.y, size: 11, font: b, color: INK });
  ctx.y -= 16;

  // Table header (light border, not dark)
  const TBL_TOP = ctx.y;
  const cols = ['Invoice Number', 'Invoice Date', 'Invoice Amount', 'Payment Amount'];
  const colX = [ML, 180, 310, 430];
  page.drawRectangle({ x: ML, y: TBL_TOP - 20, width: MR - ML, height: 20, color: LGRAY });
  cols.forEach((col, i) => {
    page.drawText(col, { x: colX[i] + 4, y: TBL_TOP - 14, size: 8, font: b, color: INK });
  });
  ctx.y = TBL_TOP - 20;

  // Data row
  const ROW_DATA_Y = ctx.y - 20;
  page.drawRectangle({ x: ML, y: ROW_DATA_Y, width: MR - ML, height: 20, color: WHITE });
  page.drawLine({ start: { x: ML, y: ROW_DATA_Y }, end: { x: MR, y: ROW_DATA_Y }, thickness: 0.5, color: LGRAY });
  const vals = [d.orderRef, d.invoiceDate, fmt(d.amount), fmt(d.amount)];
  vals.forEach((val, i) => {
    page.drawText(val, { x: colX[i] + 4, y: ROW_DATA_Y + 6, size: 9, font: r, color: INK });
  });
  ctx.y = ROW_DATA_Y - 1;
  page.drawLine({ start: { x: ML, y: ctx.y }, end: { x: MR, y: ctx.y }, thickness: 0.5, color: LGRAY });

  addFooters(ctx);
  return Buffer.from(await ctx.doc.save());
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── quoteReceivedPdf (Quote Request Confirmation — no price yet) ─────────────
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuoteRequestPdfData {
  ref: string;
  customer: string;
  email: string;
  mobile?: string | null;
  date: string;
  message?: string | null;
  items: { name: string; specs: string; units: number; sizesLabel: string }[];
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  taxId: string;
}

export async function quoteReceivedPdf(d: QuoteRequestPdfData): Promise<Buffer> {
  const ctx = await mkCtx();
  const logo = await ctx.doc.embedJpg(getLogoBytes());
  const { page, b, r } = ctx;

  drawDocHeader(
    ctx, logo,
    'Quotation', `# ${d.ref}`,
    null, null,
    { name: d.storeName, address: d.storeAddress, phone: d.storePhone, email: d.storeEmail, taxId: d.taxId },
  );

  drawBillTo(ctx, d.customer, d.email, d.mobile, [['Date', d.date]]);

  if (d.message?.trim()) {
    need(ctx, 24);
    ctx.y -= 10;
    page.drawText('Subject:', { x: ML, y: ctx.y, size: 9, font: b, color: INK });
    page.drawText(d.message.slice(0, 200), { x: ML + 55, y: ctx.y, size: 9, font: r, color: GRAY });
    ctx.y -= 16;
  }

  // Items list (no pricing columns — price TBD)
  need(ctx, ROW_H);
  const hdrY = ctx.y - ROW_H;
  page.drawRectangle({ x: ML, y: hdrY, width: MR - ML, height: ROW_H, color: TBHDR });
  const ht = hdrY + 7;
  page.drawText('#',                  { x: COL_NUM_X,  y: ht, size: 9, font: b, color: WHITE });
  page.drawText('Item & Description', { x: COL_DESC_X, y: ht, size: 9, font: b, color: WHITE });
  rAlign(page, 'Qty / Sizes', MR - 3, ht, 9, b, WHITE);
  ctx.y = hdrY;

  d.items.forEach((item, idx) => {
    const hasDesc = !!item.specs?.trim();
    const rowH = hasDesc ? ROW_H + 13 : ROW_H;
    need(ctx, rowH);
    const rowY = ctx.y - rowH;
    if (idx % 2 === 1) page.drawRectangle({ x: ML, y: rowY, width: MR - ML, height: rowH, color: LGRAY });
    const ty = rowY + rowH - ROW_H + 7;
    page.drawText(String(idx + 1), { x: COL_NUM_X,  y: ty, size: 9, font: r, color: INK });
    page.drawText(item.name,       { x: COL_DESC_X, y: ty, size: 9, font: b, color: INK });
    if (hasDesc) page.drawText(item.specs, { x: COL_DESC_X, y: ty - 12, size: 8, font: ctx.o, color: GRAY });
    const qtyLabel = item.sizesLabel || String(item.units);
    rAlign(page, qtyLabel, MR - 3, ty, 9, r, INK);
    ctx.y = rowY;
  });

  ctx.y -= 20;
  page.drawText('No price is shown — our team will review and send your custom quote within 48 hours.', {
    x: ML, y: ctx.y, size: 9, font: r, color: GRAY,
  });

  addFooters(ctx);
  return Buffer.from(await ctx.doc.save());
}
