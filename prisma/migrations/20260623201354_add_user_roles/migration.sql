-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('admin', 'manager', 'pos_user');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'admin';
