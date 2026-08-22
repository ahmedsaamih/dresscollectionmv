-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "telegramBotToken" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "telegramChatId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "telegramBotUsername" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "telegramAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegramLastTestAt" TIMESTAMP(3);
