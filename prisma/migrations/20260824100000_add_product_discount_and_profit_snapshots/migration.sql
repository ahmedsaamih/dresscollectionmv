-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discountType" TEXT,
ADD COLUMN     "discountValue" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "costPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "productDiscount" INTEGER NOT NULL DEFAULT 0;
