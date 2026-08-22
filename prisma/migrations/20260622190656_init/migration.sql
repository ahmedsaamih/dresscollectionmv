-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'soldout', 'draft');

-- CreateEnum
CREATE TYPE "OrderMethod" AS ENUM ('Pickup', 'Delivery');

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "storeName" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MVR',
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryFee" INTEGER NOT NULL DEFAULT 75,
    "heroTitle" TEXT NOT NULL,
    "heroSub" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "collectionKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "was" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "badge" TEXT,
    "colors" TEXT[],
    "sizes" TEXT[],
    "customizable" BOOLEAN NOT NULL DEFAULT false,
    "img" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderType" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "desc" TEXT NOT NULL,

    CONSTRAINT "BuilderType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderFabric" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,

    CONSTRAINT "BuilderFabric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderSleeve" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "BuilderSleeve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderNeck" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "BuilderNeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderColor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,

    CONSTRAINT "BuilderColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderSize" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "BuilderSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "items" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "method" "OrderMethod" NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "notes" TEXT,
    "date" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "img" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "configs" INTEGER NOT NULL DEFAULT 0,
    "units" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "price" INTEGER,
    "message" TEXT,
    "date" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specs" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,
    "sizesLabel" TEXT NOT NULL,
    "sizes" JSONB NOT NULL,
    "swatch" TEXT NOT NULL,
    "type" TEXT,
    "fabric" TEXT,
    "sleeve" TEXT,
    "neck" TEXT,
    "collar" BOOLEAN,
    "accent" TEXT,
    "logoName" TEXT,
    "notes" TEXT,
    "placement" TEXT,
    "artName" TEXT,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefSequence" (
    "prefix" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RefSequence_pkey" PRIMARY KEY ("prefix","year")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_key_key" ON "Collection"("key");

-- CreateIndex
CREATE INDEX "Category_collectionKey_idx" ON "Category"("collectionKey");

-- CreateIndex
CREATE INDEX "Product_collection_idx" ON "Product"("collection");

-- CreateIndex
CREATE INDEX "Order_email_idx" ON "Order"("email");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Receipt_orderId_idx" ON "Receipt"("orderId");

-- CreateIndex
CREATE INDEX "Quote_email_idx" ON "Quote"("email");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "Artwork_quoteId_idx" ON "Artwork"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_collectionKey_fkey" FOREIGN KEY ("collectionKey") REFERENCES "Collection"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
