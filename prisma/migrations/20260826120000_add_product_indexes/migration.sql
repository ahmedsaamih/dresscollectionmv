-- CreateIndex
CREATE INDEX "Product_status_showInWebStore_idx" ON "Product"("status", "showInWebStore");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_collection_status_idx" ON "Product"("collection", "status");
