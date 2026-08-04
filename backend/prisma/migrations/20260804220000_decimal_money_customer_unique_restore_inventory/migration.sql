-- ---------------------------------------------------------------------------
-- 1. Restore Inventory / InventoryUsage.
--    The 20260221175519_add_indexes migration dropped these tables, but they
--    were never removed from schema.prisma. A fresh `migrate deploy` therefore
--    produced a database that Prisma Client expected to have them. Recreate.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Inventory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 5,
    "unit" TEXT NOT NULL,
    "location" TEXT,
    "branchId" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryUsage" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "quantityUsed" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Inventory_branchId_category_idx" ON "Inventory"("branchId", "category");
CREATE INDEX IF NOT EXISTS "Inventory_branchId_quantity_idx" ON "Inventory"("branchId", "quantity");
CREATE INDEX IF NOT EXISTS "Inventory_branchId_lastUpdated_idx" ON "Inventory"("branchId", "lastUpdated");
CREATE INDEX IF NOT EXISTS "InventoryUsage_inventoryId_idx" ON "InventoryUsage"("inventoryId");
CREATE INDEX IF NOT EXISTS "InventoryUsage_bookingId_idx" ON "InventoryUsage"("bookingId");

DO $$
BEGIN
    ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_branchId_fkey"
        FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "InventoryUsage" ADD CONSTRAINT "InventoryUsage_inventoryId_fkey"
        FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "InventoryUsage" ADD CONSTRAINT "InventoryUsage_bookingId_fkey"
        FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Deduplicate customers before adding the (organizationId, phone) unique
--    constraint. The public booking endpoint's find-or-create could race and
--    create duplicates. Keep the oldest row per (org, phone), repoint that
--    duplicate's bookings at it, then delete the losers.
-- ---------------------------------------------------------------------------
WITH ranked AS (
    SELECT
        "id",
        FIRST_VALUE("id") OVER (
            PARTITION BY "organizationId", "phone" ORDER BY "id"
        ) AS keep_id
    FROM "Customer"
)
UPDATE "Booking" b
SET "customerId" = r.keep_id
FROM ranked r
WHERE b."customerId" = r."id"
  AND r."id" <> r.keep_id;

WITH ranked AS (
    SELECT
        "id",
        FIRST_VALUE("id") OVER (
            PARTITION BY "organizationId", "phone" ORDER BY "id"
        ) AS keep_id
    FROM "Customer"
)
DELETE FROM "Customer" c
USING ranked r
WHERE c."id" = r."id"
  AND r."id" <> r.keep_id;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_phone_key" ON "Customer"("organizationId", "phone");

-- ---------------------------------------------------------------------------
-- 3. Money as exact Decimal instead of double precision.
--    Existing values are rounded to 2 dp, which is what they should always
--    have been; float drift beyond the cent is discarded deliberately.
-- ---------------------------------------------------------------------------
ALTER TABLE "Invoice"
    ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);
