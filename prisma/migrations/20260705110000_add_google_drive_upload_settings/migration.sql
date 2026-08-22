ALTER TABLE "Setting"
ADD COLUMN "googleDriveUploadsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "googleDriveFolderId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "googleDriveFolderName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "googleDriveLastTestAt" TIMESTAMP(3);
