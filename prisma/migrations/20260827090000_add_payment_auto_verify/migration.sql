-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAuto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "paidVerifiedBy" TEXT,
ADD COLUMN     "balancePaidAuto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "balancePaidVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "balancePaidVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "balancePaidVerifiedBy" TEXT;

-- AlterTable
ALTER TABLE "ReceiptOcrData" ADD COLUMN     "transactionDateParsed" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ReceiptOcrData_referenceNumber_idx" ON "ReceiptOcrData"("referenceNumber");
