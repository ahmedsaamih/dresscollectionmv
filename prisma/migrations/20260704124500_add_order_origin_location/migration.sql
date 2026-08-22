ALTER TABLE "Order" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'web_checkout';
ALTER TABLE "Order" ADD COLUMN "locationId" TEXT;

UPDATE "Order"
SET "origin" = CASE
  WHEN "quoteRef" IS NOT NULL THEN 'quote_conversion'
  WHEN "source" = 'pos' THEN 'pos_sale'
  ELSE 'web_checkout'
END;

CREATE INDEX "Order_origin_idx" ON "Order"("origin");
CREATE INDEX "Order_locationId_idx" ON "Order"("locationId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
