-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "customizationGuidePdfUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "customizationTemplateXlsxUrl" TEXT NOT NULL DEFAULT '';
