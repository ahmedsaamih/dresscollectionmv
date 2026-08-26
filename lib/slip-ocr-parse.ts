/**
 * Best-effort structured-field extraction from OCR'd payment-slip text.
 *
 * Takes the plain OCR text (Tesseract's `data.text`) and pulls out fields via label-anchored
 * regexes, rather than word/paragraph bounding-box positions. An earlier bounding-box-based
 * version was only ever validated against a hand-reconstructed grouping of `tesseract --tsv`
 * CLI output; tested against Tesseract.js's own real WASM output, the engine merges labels and
 * values into large combined paragraphs (and can even reorder wrapped text) in a way bounding
 * boxes didn't reliably capture. Plain regexes anchored on each label's own text are robust to
 * that kind of paragraph-segmentation variance, since the label and its value are almost always
 * textually adjacent regardless of how the engine grouped them visually.
 *
 * This is informational-only data read off a customer-submitted image; never treat any field
 * here as proof of payment. The linked Receipt.url image is the source of truth an admin
 * verifies against.
 */

export interface ParsedSlip {
  bankName: string | null;
  status: string | null;
  referenceNumber: string | null;
  transactionDate: string | null;
  transactionDateParsed: Date | null;
  fromName: string | null;
  toName: string | null;
  toAccount: string | null;
  amount: number | null;
  currency: string | null;
}

const KNOWN_BANKS: [RegExp, string][] = [
  [/bank of maldives|\bbml\b/i, 'Bank of Maldives'],
  [/maldives islamic bank|\bmib\b/i, 'Maldives Islamic Bank'],
];

const STATUS_WORDS = '(SUCCESS|SUCCESSFUL|FAILED|PENDING|COMPLETED|DECLINED)';
const DATE_PATTERN = '\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4}(?:[ ,]+\\d{1,2}:\\d{2}(?::\\d{2})?)?';

/**
 * Best-effort parse of a raw slip date/time string into a real Date. Bank
 * slip formats vary a lot and this is read off a customer-submitted image,
 * so it's deliberately conservative: any ambiguity, out-of-range value, or
 * silent rollover (e.g. 31 Feb) returns null rather than guess. Day-first
 * (DD/MM/YYYY) is assumed — the regional convention here — unless the first
 * group is 4 digits, which is treated as YYYY-MM-DD. Never throws.
 */
function parseTransactionDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,4})[/\-](\d{1,2})[/\-](\d{1,4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;

  const [, g1, g2, g3, hh, mi, ss] = m;
  let year: number, month: number, day: number;
  if (g1.length === 4) {
    year = Number(g1); month = Number(g2); day = Number(g3);
  } else {
    day = Number(g1); month = Number(g2);
    year = Number(g3);
    if (g3.length <= 2) year += year < 70 ? 2000 : 1900;
  }
  const hours = hh ? Number(hh) : 0;
  const minutes = mi ? Number(mi) : 0;
  const seconds = ss ? Number(ss) : 0;

  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) return null;

  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  // Reject silent rollovers (e.g. 31 Feb -> 3 Mar) by re-checking the components.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function parseSlipOcr(rawText: string): ParsedSlip {
  let bankName: string | null = null;
  for (const [pattern, canonical] of KNOWN_BANKS) {
    if (pattern.test(rawText)) { bankName = canonical; break; }
  }

  const statusMatch = rawText.match(new RegExp(`\\bStatus\\b[^A-Za-z]{0,10}${STATUS_WORDS}`, 'i')) ?? rawText.match(new RegExp(`\\b${STATUS_WORDS}\\b`, 'i'));
  const status = statusMatch ? statusMatch[1].toUpperCase() : null;

  const referenceMatch = rawText.match(/\bReference\b(?:\s*Number)?\s*[:\-]?\s*([A-Z0-9]{6,})/i);
  const referenceNumber = referenceMatch ? referenceMatch[1] : null;

  const dateMatch = rawText.match(new RegExp(`\\bTransaction\\s*date\\b\\s*[:\\-]?\\s*(${DATE_PATTERN})`, 'i')) ?? rawText.match(new RegExp(DATE_PATTERN));
  const transactionDate = dateMatch ? dateMatch[1] ?? dateMatch[0] : null;
  const transactionDateParsed = parseTransactionDate(transactionDate);

  const fromMatch = rawText.match(/\bFrom\b\s*[:\-]?\s*([^\n]+)/i);
  const fromName = fromMatch ? fromMatch[1].trim() || null : null;

  let toName: string | null = null;
  let toAccount: string | null = null;
  const toMatch = rawText.match(/\bTo\b\s*[:\-]?\s*\n?\s*([^\n]+)(?:\n\s*([^\n]+))?/i);
  if (toMatch) {
    const line1 = toMatch[1]?.trim() || null;
    const line2 = toMatch[2]?.trim() || null;
    // Some layouts print the account number right after "To" (a wrapped name the engine
    // reordered ahead of it) — if it looks like a bare account number, treat it as such rather
    // than a name, and don't also grab the next line: at that point it's unrelated adjacent
    // text (the following field), not part of this value.
    if (line1 && /^\d[\d\s-]{4,}$/.test(line1)) { toAccount = line1; } else { toName = line1; toAccount = line2; }
  }

  let amount: number | null = null;
  let currency: string | null = null;
  const amountMatch = rawText.match(/\bAmount\b[^A-Za-z0-9]{0,15}([A-Z]{3})\s*[:\-]?\s*([\d,]+\.\d{2})\b/i) ?? rawText.match(/([A-Z]{3})\s*[:\-]?\s*([\d,]+\.\d{2})\b/);
  if (amountMatch) {
    currency = amountMatch[1].toUpperCase();
    amount = Number(amountMatch[2].replace(/,/g, ''));
  }

  return { bankName, status, referenceNumber, transactionDate, transactionDateParsed, fromName, toName, toAccount, amount, currency };
}
