-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "materials" TEXT[] DEFAULT ARRAY[]::TEXT[];
