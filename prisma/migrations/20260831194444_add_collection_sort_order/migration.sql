-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill sortOrder to match the homepage's previous hardcoded tile order
-- (ready, occasion, casual, accessories) so this migration is a no-op
-- visually — any collection key not in this list keeps the default 0 and
-- sorts first, alongside "ready", until an admin sets it explicitly.
UPDATE "Collection" SET "sortOrder" = 1 WHERE "key" = 'occasion';
UPDATE "Collection" SET "sortOrder" = 2 WHERE "key" = 'casual';
UPDATE "Collection" SET "sortOrder" = 3 WHERE "key" = 'accessories';
