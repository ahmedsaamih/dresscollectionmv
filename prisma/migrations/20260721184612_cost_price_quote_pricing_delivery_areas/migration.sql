-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryAreaId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPrice" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "computedPrice" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "customizationCost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "customizationLines" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "unitPrice" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DeliveryArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_deliveryAreaId_idx" ON "Order"("deliveryAreaId");

-- CreateIndex
CREATE INDEX "QuoteItem_productId_idx" ON "QuoteItem"("productId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryAreaId_fkey" FOREIGN KEY ("deliveryAreaId") REFERENCES "DeliveryArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed one initial delivery area from the existing flat Setting.deliveryFee so
-- checkout behavior is unchanged immediately after this deploy; admin can
-- rename/add more areas afterward.
INSERT INTO "DeliveryArea" ("id", "name", "rate", "active", "sortOrder", "createdAt")
SELECT 'delivery-area-legacy', 'Delivery', "deliveryFee", true, 0, CURRENT_TIMESTAMP
FROM "Setting"
WHERE "id" = 'singleton'
ON CONFLICT ("id") DO NOTHING;
