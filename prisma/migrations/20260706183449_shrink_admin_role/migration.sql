-- AlterEnum
-- Postgres can't drop enum values directly, so recreate the type with just
-- the final value set. Safe at this point: scripts/migrate-admin-permissions.mjs
-- already converted every manager/pos_user/quotation_approver row to 'staff'.
BEGIN;
CREATE TYPE "AdminRole_new" AS ENUM ('admin', 'staff');
ALTER TABLE "AdminUser" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "AdminUser" ALTER COLUMN "role" TYPE "AdminRole_new" USING ("role"::text::"AdminRole_new");
ALTER TYPE "AdminRole" RENAME TO "AdminRole_old";
ALTER TYPE "AdminRole_new" RENAME TO "AdminRole";
DROP TYPE "AdminRole_old";
ALTER TABLE "AdminUser" ALTER COLUMN "role" SET DEFAULT 'admin';
COMMIT;
