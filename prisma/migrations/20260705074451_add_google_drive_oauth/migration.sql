-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "googleDriveConnectedEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "googleDriveRefreshToken" TEXT NOT NULL DEFAULT '';
