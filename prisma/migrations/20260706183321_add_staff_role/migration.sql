-- AlterEnum
-- Additive step: add 'staff' alongside the legacy values so existing rows
-- (manager/pos_user/quotation_approver) can be converted by
-- scripts/migrate-admin-permissions.mjs before the legacy values are
-- dropped in a later migration.
ALTER TYPE "AdminRole" ADD VALUE 'staff';
