-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "paymentSlipUploadedAt" TIMESTAMP(3),
ADD COLUMN     "paymentSlipUrl" TEXT;
