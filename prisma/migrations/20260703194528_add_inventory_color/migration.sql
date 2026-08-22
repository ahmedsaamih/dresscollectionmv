-- DropIndex
DROP INDEX "Inventory_locationId_productId_size_key";

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "StockAdjustment" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_locationId_productId_size_color_key" ON "Inventory"("locationId", "productId", "size", "color");

