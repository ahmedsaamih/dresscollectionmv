-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pdfExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReceiptOcrData" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "bankName" TEXT,
    "status" TEXT,
    "referenceNumber" TEXT,
    "transactionDate" TEXT,
    "fromName" TEXT,
    "toName" TEXT,
    "toAccount" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptOcrData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptOcrData_receiptId_key" ON "ReceiptOcrData"("receiptId");

-- AddForeignKey
ALTER TABLE "ReceiptOcrData" ADD CONSTRAINT "ReceiptOcrData_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
