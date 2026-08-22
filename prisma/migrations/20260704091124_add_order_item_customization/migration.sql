-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "customizationCost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "customizationLines" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "customizationNote" TEXT NOT NULL DEFAULT '';
