ALTER TABLE "Order" ADD COLUMN "deliveryFee" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "readyForDeliveryAt" TIMESTAMP(3);

UPDATE "Order"
SET "deliveryFee" = GREATEST("total" - "subtotal" + "discount", 0)
WHERE "method" = 'Delivery';

UPDATE "Order"
SET "readyForDeliveryAt" = COALESCE(
  TO_TIMESTAMP("date", 'DD Mon YYYY'),
  "createdAt"
)
WHERE "method" = 'Delivery'
  AND "stage" IN (3, 4)
  AND "readyForDeliveryAt" IS NULL;

CREATE INDEX "Order_method_stage_idx" ON "Order"("method", "stage");
CREATE INDEX "Order_readyForDeliveryAt_idx" ON "Order"("readyForDeliveryAt");
