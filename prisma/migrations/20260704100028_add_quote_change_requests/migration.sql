-- CreateEnum
CREATE TYPE "QuoteChangeRequestStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'quotation_approver';

-- CreateTable
CREATE TABLE "QuoteChangeRequest" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "currentStage" INTEGER NOT NULL,
    "currentPrice" INTEGER,
    "requestedStage" INTEGER,
    "requestedPrice" INTEGER,
    "status" "QuoteChangeRequestStatus" NOT NULL DEFAULT 'pending',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteChangeRequest_quoteId_idx" ON "QuoteChangeRequest"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteChangeRequest_status_idx" ON "QuoteChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "QuoteChangeRequest" ADD CONSTRAINT "QuoteChangeRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
