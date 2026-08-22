-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "stockDecremented" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "sizeBreakdown" JSONB;

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN "colorName" TEXT;
