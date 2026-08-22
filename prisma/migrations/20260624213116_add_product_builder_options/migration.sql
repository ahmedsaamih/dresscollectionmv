-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "necks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sizeStock" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "sleeves" TEXT[] DEFAULT ARRAY[]::TEXT[];
