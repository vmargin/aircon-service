-- Nullable fields preserve existing stock history and allow unkeyed legacy clients.
ALTER TABLE "StockMovement"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "idempotencyPayloadHash" VARCHAR(64);

CREATE UNIQUE INDEX "StockMovement_idempotencyKey_key"
ON "StockMovement"("idempotencyKey");
