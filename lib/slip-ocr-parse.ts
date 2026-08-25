/**
 * Best-effort structured-field extraction from OCR'd payment-slip text.
 *
 * Input is block-level (paragraph-level) OCR output — each block's `text` may
 * contain internal newlines for a wrapped multi-line value (e.g. a recipient
 * name over one line and an account number over the next), and `x0`/`y0` are
 * its top-left position in the source image. This shape is deliberately
 * generic: the browser caller adapts Tesseract.js's `data.paragraphs`, and a
 * standalone test script adapts `tesseract --tsv` rows grouped by block_num —
 * see the verification script for the latter.
 *
 * This is informational-only data read off a customer-submitted image; never
 * treat any field here as proof of payment. The linked Receipt.url image is
 * the source of truth an admin verifies against.
 */

export interface OcrBlock {
  text: string;
  x0: number;
  y0: number;
}

export interface ParsedSlip {
  bankName: string | null;
  status: string | null;
  referenceNumber: string | null;
  transactionDate: string | null;
  fromName: string | null;
  toName: string | null;
  toAccount: string | null;
  amount: number | null;
  currency: string | null;
  rawText: string;
}

const LABEL_TEXT: Record<'status' | 'reference' | 'date' | 'from' | 'to' | 'amount', string[]> = {
  status: ['status'],
  reference: ['reference', 'reference number', 'ref no', 'ref'],
  date: ['transaction date', 'date', 'date & time', 'date and time'],
  from: ['from', 'sender', 'debit account'],
  to: ['to', 'recipient', 'credit account', 'beneficiary'],
  amount: ['amount', 'transaction amount'],
};

const KNOWN_BANKS: [RegExp, string][] = [
  [/bank of maldives|\bbml\b/i, 'Bank of Maldives'],
  [/maldives islamic bank|\bmib\b/i, 'Maldives Islamic Bank'],
];

function norm(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findLabelBlock(blocks: OcrBlock[], key: keyof typeof LABEL_TEXT): OcrBlock | null {
  const candidates = LABEL_TEXT[key];
  return blocks.find(b => candidates.includes(norm(b.text))) ?? null;
}

/** Nearest same-row value block to the right of a label, within a loose vertical band. */
function nearestValueBlock(label: OcrBlock | null, valueBlocks: OcrBlock[], maxDist = 150): OcrBlock | null {
  if (!label) return null;
  let best: OcrBlock | null = null;
  let bestDist = Infinity;
  for (const v of valueBlocks) {
    if (v.x0 <= label.x0) continue;
    const dist = Math.abs(v.y0 - label.y0);
    if (dist < maxDist && dist < bestDist) { best = v; bestDist = dist; }
  }
  return best;
}

export function parseSlipOcr(blocks: OcrBlock[]): ParsedSlip {
  const rawText = blocks.map(b => b.text).join('\n');
  const labelBlockSet = new Set<OcrBlock>();
  const labelBlocks: Partial<Record<keyof typeof LABEL_TEXT, OcrBlock>> = {};
  for (const key of Object.keys(LABEL_TEXT) as (keyof typeof LABEL_TEXT)[]) {
    const block = findLabelBlock(blocks, key);
    if (block) { labelBlocks[key] = block; labelBlockSet.add(block); }
  }
  const valueBlocks = blocks.filter(b => !labelBlockSet.has(b));

  let bankName: string | null = null;
  for (const [pattern, canonical] of KNOWN_BANKS) {
    if (pattern.test(rawText)) { bankName = canonical; break; }
  }

  const statusPattern = /\b(SUCCESS|SUCCESSFUL|FAILED|PENDING|COMPLETED|DECLINED)\b/i;
  const statusBlock = nearestValueBlock(labelBlocks.status ?? null, valueBlocks);
  const statusMatch = (statusBlock?.text ?? '').match(statusPattern) ?? rawText.match(statusPattern);
  const status = statusMatch ? statusMatch[1].toUpperCase() : null;

  const dateMatch = rawText.match(/\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}(?:[ ,]+\d{1,2}:\d{2}(?::\d{2})?)?/);
  const transactionDate = dateMatch ? dateMatch[0].trim() : null;

  const fromBlock = nearestValueBlock(labelBlocks.from ?? null, valueBlocks);
  const fromName = fromBlock ? fromBlock.text.split('\n')[0]?.trim() || null : null;

  const toBlock = nearestValueBlock(labelBlocks.to ?? null, valueBlocks);
  const toLines = toBlock ? toBlock.text.split('\n').map(l => l.trim()).filter(Boolean) : [];
  const toName = toLines[0] ?? null;
  const toAccount = toLines[1] ?? null;

  let amount: number | null = null;
  let currency: string | null = null;
  const amountBlock = nearestValueBlock(labelBlocks.amount ?? null, valueBlocks);
  const amountSource = amountBlock ? amountBlock.text : rawText;
  const amountMatch = amountSource.match(/([A-Z]{3})\s*[:\-]?\s*([\d,]+\.\d{2})\b/);
  if (amountMatch) {
    currency = amountMatch[1].toUpperCase();
    amount = Number(amountMatch[2].replace(/,/g, ''));
  }

  const refCandidates = valueBlocks.filter(b => /^[A-Z0-9]{8,}$/.test(b.text.trim()));
  let referenceNumber: string | null = null;
  if (refCandidates.length) {
    const nearest = labelBlocks.reference
      ? refCandidates.slice().sort((a, b) => Math.abs(a.y0 - labelBlocks.reference!.y0) - Math.abs(b.y0 - labelBlocks.reference!.y0))[0]
      : refCandidates[0];
    referenceNumber = nearest.text.trim();
  }

  return { bankName, status, referenceNumber, transactionDate, fromName, toName, toAccount, amount, currency, rawText };
}
