-- Shelf/bin placement is shared by all variant inventory rows for a product at a physical location.
CREATE TABLE "InventoryPlacement" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "physicalLocation" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPlacement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryPlacement_locationId_productId_key" ON "InventoryPlacement"("locationId", "productId");
CREATE INDEX "InventoryPlacement_productId_idx" ON "InventoryPlacement"("productId");
CREATE INDEX "InventoryPlacement_locationId_idx" ON "InventoryPlacement"("locationId");

ALTER TABLE "InventoryPlacement" ADD CONSTRAINT "InventoryPlacement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryPlacement" ADD CONSTRAINT "InventoryPlacement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
