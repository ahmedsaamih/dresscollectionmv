-- Remove the customization/builder system and the Quote pipeline entirely.
-- This store is fixed-price ready-to-wear and will never use either.
-- Generated via `prisma migrate diff --from-schema-datamodel --to-schema-datamodel`
-- against the schema before/after this change (verified offline, no DB needed).

-- DropForeignKey
ALTER TABLE "CustomizationField" DROP CONSTRAINT "CustomizationField_profileId_fkey";

-- DropForeignKey
ALTER TABLE "CustomizationProfileAssignment" DROP CONSTRAINT "CustomizationProfileAssignment_profileId_fkey";

-- DropForeignKey
ALTER TABLE "CustomizationProfileAssignment" DROP CONSTRAINT "CustomizationProfileAssignment_productId_fkey";

-- DropForeignKey
ALTER TABLE "QuoteChangeRequest" DROP CONSTRAINT "QuoteChangeRequest_quoteId_fkey";

-- DropForeignKey
ALTER TABLE "QuoteItem" DROP CONSTRAINT "QuoteItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "QuoteItem" DROP CONSTRAINT "QuoteItem_quoteId_fkey";

-- DropForeignKey
ALTER TABLE "Artwork" DROP CONSTRAINT "Artwork_quoteId_fkey";

-- AlterTable
ALTER TABLE "Setting" DROP COLUMN "builderFields",
DROP COLUMN "customizationGuidePdfUrl",
DROP COLUMN "customizationTemplateXlsxUrl",
DROP COLUMN "googleDriveConnectedEmail",
DROP COLUMN "googleDriveFolderId",
DROP COLUMN "googleDriveFolderName",
DROP COLUMN "googleDriveLastTestAt",
DROP COLUMN "googleDriveRefreshToken",
DROP COLUMN "googleDriveUploadsEnabled";

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "bespoke";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "colorImages",
DROP COLUMN "customizable",
DROP COLUMN "materials",
DROP COLUMN "necks",
DROP COLUMN "sizeAdjustments",
DROP COLUMN "sleeveAdjustments",
DROP COLUMN "sleeveImages",
DROP COLUMN "sleeves";

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "customizationCost",
DROP COLUMN "customizationLines",
DROP COLUMN "customizationNote",
DROP COLUMN "neck",
DROP COLUMN "sleeve";

-- DropTable
DROP TABLE "CustomizationProfile";

-- DropTable
DROP TABLE "CustomizationField";

-- DropTable
DROP TABLE "CustomizationProfileAssignment";

-- DropTable
DROP TABLE "BuilderType";

-- DropTable
DROP TABLE "BuilderFabric";

-- DropTable
DROP TABLE "BuilderSleeve";

-- DropTable
DROP TABLE "BuilderNeck";

-- DropTable
DROP TABLE "BuilderColor";

-- DropTable
DROP TABLE "BuilderSize";

-- DropTable
DROP TABLE "Quote";

-- DropTable
DROP TABLE "QuoteChangeRequest";

-- DropTable
DROP TABLE "QuoteItem";

-- DropTable
DROP TABLE "Artwork";

-- DropEnum
DROP TYPE "QuoteCustomerDecision";

-- DropEnum
DROP TYPE "QuoteChangeRequestStatus";

-- Data cleanup (not a schema change) — the QT ref-sequence row is now meaningless
DELETE FROM "RefSequence" WHERE "prefix" = 'QT';
