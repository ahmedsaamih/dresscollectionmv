-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "categoryAccessoriesImage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "categoryCasualImage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "categoryCustomImage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "categoryReadyImage" TEXT NOT NULL DEFAULT '';
