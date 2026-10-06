-- Service-site addresses and access instructions are visible only to the
-- branch that owns the site. Existing unassigned sites remain admin-only.
ALTER TABLE "ServiceSite" ADD COLUMN "branchId" TEXT;

CREATE INDEX "ServiceSite_branchId_isActive_idx" ON "ServiceSite"("branchId", "isActive");

ALTER TABLE "ServiceSite"
ADD CONSTRAINT "ServiceSite_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
