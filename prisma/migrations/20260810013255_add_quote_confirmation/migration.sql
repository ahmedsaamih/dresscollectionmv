-- CreateEnum
CREATE TYPE "QuoteCustomerDecision" AS ENUM ('pending', 'confirmed', 'rejected');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "customerDecision" "QuoteCustomerDecision" NOT NULL DEFAULT 'pending',
ADD COLUMN     "confirmationToken" TEXT,
ADD COLUMN     "confirmationTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "sentForConfirmationAt" TIMESTAMP(3),
ADD COLUMN     "respondedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_confirmationToken_key" ON "Quote"("confirmationToken");
