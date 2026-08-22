-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "emailAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailFromName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emailFromUser" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emailLastTestAt" TIMESTAMP(3),
ADD COLUMN     "mailjetApiKeyPrivate" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mailjetApiKeyPublic" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "msgowlApiKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "msgowlSenderId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "smsAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsLastTestAt" TIMESTAMP(3);
