-- CreateEnum
CREATE TYPE "BookingPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Technician" ADD COLUMN     "specialty" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Residential';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "checklist" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "diagnosis" TEXT,
ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "priority" "BookingPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "ledgerEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "serialNumber" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Split type',
    "capacity" TEXT,
    "location" TEXT,
    "installedAt" TIMESTAMP(3),
    "nextMaintenanceAt" TIMESTAMP(3),
    "notes" TEXT,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 5,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartUsage" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Unit_organizationId_idx" ON "Unit"("organizationId");

-- CreateIndex
CREATE INDEX "Unit_customerId_idx" ON "Unit"("customerId");

-- CreateIndex
CREATE INDEX "Unit_nextMaintenanceAt_idx" ON "Unit"("nextMaintenanceAt");

-- CreateIndex
CREATE INDEX "InventoryItem_branchId_idx" ON "InventoryItem"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_branchId_sku_key" ON "InventoryItem"("branchId", "sku");

-- CreateIndex
CREATE INDEX "PartUsage_bookingId_idx" ON "PartUsage"("bookingId");

-- CreateIndex
CREATE INDEX "PartUsage_inventoryItemId_idx" ON "PartUsage"("inventoryItemId");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryItemId_createdAt_idx" ON "StockMovement"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_createdAt_idx" ON "Payment"("invoiceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartUsage" ADD CONSTRAINT "PartUsage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartUsage" ADD CONSTRAINT "PartUsage_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve physical stock and exact-payment invariants even outside the API.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_durationMinutes_check" CHECK ("durationMinutes" BETWEEN 30 AND 480);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_stock_check" CHECK ("quantityOnHand" >= 0 AND "reorderLevel" >= 0 AND "unitCost" >= 0);
ALTER TABLE "PartUsage" ADD CONSTRAINT "PartUsage_quantity_check" CHECK ("quantity" > 0 AND "unitPrice" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0);
