-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidCard" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paidCash" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paidTransfer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'web';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "sleeve" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "showOnWeb" BOOLEAN NOT NULL DEFAULT false,
    "isWebDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT '',
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT '',
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Inventory_locationId_idx" ON "Inventory"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_locationId_productId_size_key" ON "Inventory"("locationId", "productId", "size");

-- CreateIndex
CREATE INDEX "StockTransfer_fromId_idx" ON "StockTransfer"("fromId");

-- CreateIndex
CREATE INDEX "StockTransfer_toId_idx" ON "StockTransfer"("toId");

-- CreateIndex
CREATE INDEX "StockTransfer_productId_idx" ON "StockTransfer"("productId");

-- CreateIndex
CREATE INDEX "StockTransfer_createdAt_idx" ON "StockTransfer"("createdAt");

-- CreateIndex
CREATE INDEX "Order_source_idx" ON "Order"("source");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
