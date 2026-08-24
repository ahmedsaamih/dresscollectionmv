import { ImageResponse } from 'next/og';
import { RECEIPT_LOGO_DATA_URI } from '@/lib/receipt-logo';

const INK = '#1a1a1a';
const GRAY = '#808080';
const LGRAY = '#ededed';
const GREEN = '#6bae42';
const WHITE = '#ffffff';
const PW = 595;
const PH = 842;

function fmt(n: number): string {
  return 'MVR ' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export interface PaymentReceiptImageData {
  orderRef: string;
  customer: string;
  paymentDate: string;
  paymentMode: string;
  referenceNumber: string;
  subtotal: number; // net product subtotal — already reflects any per-product discount
  deliveryFee: number;
  discount: number; // promo/manual cart-level discount
  productDiscount: number; // per-product automatic discount aggregate
  total: number; // the order's full total, for reconciliation
  depositRequired: number; // equals `total` for a non-pre-order order
  balanceDue: number; // 0 unless the order contains pre-order items
  isBalancePayment: boolean; // true when this receipt documents the balance installment, not the deposit
  amount: number; // the amount THIS receipt documents (depositRequired, balanceDue, or total)
  invoiceDate: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  taxId: string;
}

/** Label/value row for the breakdown and "Payment for" table sections. */
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 6 }}>
      <span style={{ color: bold ? INK : GRAY, fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ color: INK, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

export async function paymentReceiptImage(d: PaymentReceiptImageData): Promise<Buffer> {
  const contactLine = [d.storePhone, d.storeEmail].filter(Boolean).join('  ·  ');
  const cols = ['Invoice Number', 'Invoice Date', 'Invoice Amount', 'Payment Amount'];
  const vals = [d.orderRef, d.invoiceDate, fmt(d.total), fmt(d.amount)];
  const isSplitOrder = d.balanceDue > 0; // this order actually has a deposit/balance split
  const amountLabel = d.isBalancePayment ? 'Balance Received' : isSplitOrder ? 'Deposit Received' : 'Amount Received';
  // "Product Subtotal" shown gross (pre-discount) so "Product savings" below it is a real
  // subtraction back down to the net d.subtotal — d.subtotal already has productDiscount
  // baked out, so subtracting it again would double-count and undercount the real total.
  const grossSubtotal = d.subtotal + d.productDiscount;

  const img = new ImageResponse(
    (
      <div style={{ width: PW, height: PH, display: 'flex', flexDirection: 'column', padding: '40px 50px', fontFamily: 'sans-serif', background: WHITE }}>
        {/* Header: logo + store info */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={RECEIPT_LOGO_DATA_URI} width={90} height={90} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{d.storeName}</span>
            {d.storeAddress && <span style={{ fontSize: 9, color: GRAY, marginTop: 6 }}>{d.storeAddress}</span>}
            {contactLine && <span style={{ fontSize: 9, color: GRAY, marginTop: 4 }}>{contactLine}</span>}
            {d.taxId && <span style={{ fontSize: 9, color: GRAY, marginTop: 4 }}>Tax ID: {d.taxId}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', height: 1, background: LGRAY, marginTop: 24, marginBottom: 22 }} />

        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'center', fontSize: 15, fontWeight: 700, letterSpacing: 4, color: INK }}>
          PAYMENT RECEIPT
        </div>

        {/* Two-column info block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {([['Payment Date', d.paymentDate], ['Reference Number', d.referenceNumber], ['Payment Mode', d.paymentMode]] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
                <span style={{ fontSize: 9, color: GRAY }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: INK, marginTop: 3 }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', width: 220, height: 80, background: GREEN, padding: '12px 14px', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, color: WHITE }}>{amountLabel}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: WHITE, alignSelf: 'center' }}>{fmt(d.amount)}</span>
          </div>
        </div>

        {/* Received From */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
          <span style={{ fontSize: 9, color: GRAY }}>Received From</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: INK, marginTop: 5 }}>{d.customer}</span>
        </div>

        <div style={{ display: 'flex', height: 1, background: LGRAY, marginTop: 20, marginBottom: 18 }} />

        {/* Breakdown — reconciles top to bottom to Order Total */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Row label="Product Subtotal" value={fmt(grossSubtotal)} />
          {d.productDiscount > 0 && <Row label="Product savings" value={`(−) ${fmt(d.productDiscount)}`} />}
          {d.deliveryFee > 0 && <Row label="Delivery" value={fmt(d.deliveryFee)} />}
          {d.discount > 0 && <Row label="Discount" value={`(−) ${fmt(d.discount)}`} />}
          <div style={{ display: 'flex', height: 1, background: LGRAY, marginTop: 4, marginBottom: 8 }} />
          <Row label="Order Total" value={fmt(d.total)} bold />
          {isSplitOrder && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
              <Row label={`Deposit (50%)${d.isBalancePayment ? '' : ' — this receipt'}`} value={fmt(d.depositRequired)} bold={!d.isBalancePayment} />
              <Row label={`Balance${d.isBalancePayment ? ' — this receipt' : ' — due'}`} value={fmt(d.balanceDue)} bold={d.isBalancePayment} />
            </div>
          )}
        </div>

        {/* Payment for table */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: INK, marginBottom: 10 }}>Payment for</span>
          <div style={{ display: 'flex', background: LGRAY, padding: '6px 0' }}>
            {cols.map((c) => (
              <span key={c} style={{ flex: 1, fontSize: 8, fontWeight: 700, color: INK, paddingLeft: 4 }}>{c}</span>
            ))}
          </div>
          <div style={{ display: 'flex', borderBottom: `1px solid ${LGRAY}`, padding: '8px 0' }}>
            {vals.map((v, i) => (
              <span key={i} style={{ flex: 1, fontSize: 9, color: INK, paddingLeft: 4 }}>{v}</span>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: PW, height: PH }
  );
  return Buffer.from(await img.arrayBuffer());
}
