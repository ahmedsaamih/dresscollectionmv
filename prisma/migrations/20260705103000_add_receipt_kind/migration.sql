ALTER TABLE "Receipt" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'payment_slip';

UPDATE "Receipt"
SET "kind" = 'payment_receipt'
WHERE lower("url") LIKE '%-receipt.pdf%';

CREATE INDEX "Receipt_kind_idx" ON "Receipt"("kind");
