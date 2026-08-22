-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "sizeChartId" TEXT;

-- CreateTable
CREATE TABLE "SizeChart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "columns" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SizeChart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collection_sizeChartId_idx" ON "Collection"("sizeChartId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_sizeChartId_fkey" FOREIGN KEY ("sizeChartId") REFERENCES "SizeChart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: explode the legacy Setting.sizeChart.tables[] JSON array into standalone
-- SizeChart rows. Mechanically marks the first table as default — an admin should
-- verify/re-pick the default afterward via the admin UI. Setting.sizeChart itself is
-- left in place (unused) for a safe rollback window and dropped in a later migration.
INSERT INTO "SizeChart" ("id", "name", "note", "columns", "rows", "isDefault", "createdAt", "updatedAt")
SELECT
  t."table"->>'id',
  t."table"->>'name',
  COALESCE(s."sizeChart"->>'note', ''),
  COALESCE(t."table"->'columns', '[]'::jsonb),
  COALESCE(t."table"->'rows', '[]'::jsonb),
  (t.ord = 1),
  now(),
  now()
FROM "Setting" s
CROSS JOIN LATERAL jsonb_array_elements(s."sizeChart"->'tables') WITH ORDINALITY AS t("table", ord)
WHERE s.id = 'singleton'
  AND s."sizeChart" IS NOT NULL
  AND jsonb_typeof(s."sizeChart"->'tables') = 'array'
  AND jsonb_array_length(s."sizeChart"->'tables') > 0
ON CONFLICT ("id") DO NOTHING;

-- Fallback: fresh/empty installs with no legacy size chart data get one seed default
-- chart, guaranteeing a default always exists immediately after this migration.
INSERT INTO "SizeChart" ("id", "name", "note", "columns", "rows", "isDefault", "createdAt", "updatedAt")
SELECT
  'sc-adult',
  'Adult',
  'Measurements in centimetres. If you are between sizes, size up for a relaxed fit.',
  '["Size","Chest (cm)","Length (cm)","Shoulder (cm)"]'::jsonb,
  '[["XS","46","68","42"],["S","49","70","44"],["M","52","72","46"],["L","55","74","48"],["XL","58","76","50"],["2XL","61","78","52"]]'::jsonb,
  true,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM "SizeChart");
