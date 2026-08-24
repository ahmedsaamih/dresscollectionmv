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
  return 'MVR ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface PaymentReceiptImageData {
  orderRef: string;
  customer: string;
  paymentDate: string;
  paymentMode: string;
  referenceNumber: string;
  subtotal: number;
  deliveryFee: number;
  discount: number; // existing promo/manual cart-level discount
  productDiscount: number; // per-product automatic discount (new)
  amount: number;
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
  const vals = [d.orderRef, d.invoiceDate, fmt(d.amount), fmt(d.amount)];

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
            <span style={{ fontSize: 9, color: WHITE }}>Amount Received</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: WHITE, alignSelf: 'center' }}>{fmt(d.amount)}</span>
          </div>
        </div>

        {/* Received From */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
          <span style={{ fontSize: 9, color: GRAY }}>Received From</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: INK, marginTop: 5 }}>{d.customer}</span>
        </div>

        <div style={{ display: 'flex', height: 1, background: LGRAY, marginTop: 20, marginBottom: 18 }} />

        {/* Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Row label="Product Subtotal" value={fmt(d.subtotal)} />
          {d.deliveryFee > 0 && <Row label="Delivery" value={fmt(d.deliveryFee)} />}
          {d.discount > 0 && <Row label="Discount" value={`(−) ${fmt(d.discount)}`} />}
          {d.productDiscount > 0 && <Row label="Product savings" value={`(−) ${fmt(d.productDiscount)}`} />}
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
