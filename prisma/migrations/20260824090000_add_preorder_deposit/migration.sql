-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "preOrder" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "depositRequired" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "balanceDue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "balancePaid" BOOLEAN NOT NULL DEFAULT false;
