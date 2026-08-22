-- AlterTable
ALTER TABLE "Setting" DROP COLUMN "mailjetApiKeyPublic";

-- AlterTable
ALTER TABLE "Setting" RENAME COLUMN "mailjetApiKeyPrivate" TO "emailApiKey";
