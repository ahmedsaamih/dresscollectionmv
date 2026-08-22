-- CreateTable
CREATE TABLE "CustomizationProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomizationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationField" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "helpText" TEXT NOT NULL DEFAULT '',
    "placeholder" TEXT NOT NULL DEFAULT '',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomizationField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationProfileAssignment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "collectionKey" TEXT,
    "categoryId" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomizationProfileAssignment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN "customizationProfileId" TEXT;
ALTER TABLE "QuoteItem" ADD COLUMN "customizationProfileName" TEXT;
ALTER TABLE "QuoteItem" ADD COLUMN "customizationAnswers" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "CustomizationProfile_active_idx" ON "CustomizationProfile"("active");

-- CreateIndex
CREATE INDEX "CustomizationProfile_sortOrder_idx" ON "CustomizationProfile"("sortOrder");

-- CreateIndex
CREATE INDEX "CustomizationField_profileId_idx" ON "CustomizationField"("profileId");

-- CreateIndex
CREATE INDEX "CustomizationField_sortOrder_idx" ON "CustomizationField"("sortOrder");

-- CreateIndex
CREATE INDEX "CustomizationProfileAssignment_profileId_idx" ON "CustomizationProfileAssignment"("profileId");

-- CreateIndex
CREATE INDEX "CustomizationProfileAssignment_scope_idx" ON "CustomizationProfileAssignment"("scope");

-- CreateIndex
CREATE INDEX "CustomizationProfileAssignment_collectionKey_idx" ON "CustomizationProfileAssignment"("collectionKey");

-- CreateIndex
CREATE INDEX "CustomizationProfileAssignment_categoryId_idx" ON "CustomizationProfileAssignment"("categoryId");

-- CreateIndex
CREATE INDEX "CustomizationProfileAssignment_productId_idx" ON "CustomizationProfileAssignment"("productId");

-- AddForeignKey
ALTER TABLE "CustomizationField" ADD CONSTRAINT "CustomizationField_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomizationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationProfileAssignment" ADD CONSTRAINT "CustomizationProfileAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomizationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationProfileAssignment" ADD CONSTRAINT "CustomizationProfileAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
