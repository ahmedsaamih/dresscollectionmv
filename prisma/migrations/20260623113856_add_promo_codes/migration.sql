-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "PromoScope" AS ENUM ('all', 'collection', 'category');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('none', 'percent_of_order', 'percent_of_discount', 'fixed');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountCode" TEXT,
ADD COLUMN     "subtotal" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "scope" "PromoScope" NOT NULL DEFAULT 'all',
    "scopeValue" TEXT,
    "minSubtotal" INTEGER NOT NULL DEFAULT 0,
    "maxRedemptions" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "referrer" TEXT,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'none',
    "commissionValue" INTEGER NOT NULL DEFAULT 0,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "codeId" TEXT,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "eligible" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,
    "referrer" TEXT,
    "commission" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_referrer_idx" ON "PromoCode"("referrer");

-- CreateIndex
CREATE UNIQUE INDEX "Redemption_orderId_key" ON "Redemption"("orderId");

-- CreateIndex
CREATE INDEX "Redemption_codeId_idx" ON "Redemption"("codeId");

-- CreateIndex
CREATE INDEX "Redemption_referrer_idx" ON "Redemption"("referrer");

-- CreateIndex
CREATE INDEX "Redemption_createdAt_idx" ON "Redemption"("createdAt");

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
