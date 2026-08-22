-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '{}';
