-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sizeAdjustments" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "sleeveAdjustments" JSONB NOT NULL DEFAULT '{}';
