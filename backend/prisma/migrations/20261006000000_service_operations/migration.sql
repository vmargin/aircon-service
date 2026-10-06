-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('NEW', 'NEEDS_ASSESSMENT', 'READY_TO_SCHEDULE', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "EstimateApprovalMethod" AS ENUM ('PHONE', 'IN_PERSON', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "InspectionItemType" AS ENUM ('CHECK', 'MEASUREMENT');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "accessNotes" TEXT,
ADD COLUMN     "estimateRevisionId" TEXT,
ADD COLUMN     "inspectionTemplateId" TEXT,
ADD COLUMN     "serviceAddress" TEXT,
ADD COLUMN     "serviceRequestId" TEXT,
ADD COLUMN     "serviceSiteId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "estimateRevisionId" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "serviceSiteId" TEXT;

-- CreateTable
CREATE TABLE "ServiceSite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "accessNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'NEW',
    "serviceType" TEXT NOT NULL,
    "priority" "BookingPriority" NOT NULL DEFAULT 'NORMAL',
    "reportedIssue" TEXT NOT NULL,
    "serviceAddress" TEXT NOT NULL,
    "preferredWindowStart" TIMESTAMP(3),
    "preferredWindowEnd" TIMESTAMP(3),
    "accessNotes" TEXT,
    "internalNotes" TEXT,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceSiteId" TEXT,
    "unitId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateRevision" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvalMethod" "EstimateApprovalMethod",
    "approvalContact" TEXT,
    "approvalNote" TEXT,
    "decisionNote" TEXT,
    "approvedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateLineItem" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sourceLineId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "InspectionItemType" NOT NULL DEFAULT 'CHECK',
    "unitLabel" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceSite_organizationId_customerId_idx" ON "ServiceSite"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "ServiceSite_customerId_isActive_idx" ON "ServiceSite"("customerId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_status_createdAt_idx" ON "ServiceRequest"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_branchId_status_createdAt_idx" ON "ServiceRequest"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_customerId_createdAt_idx" ON "ServiceRequest"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_serviceSiteId_idx" ON "ServiceRequest"("serviceSiteId");

-- CreateIndex
CREATE INDEX "ServiceRequest_unitId_idx" ON "ServiceRequest"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_serviceRequestId_key" ON "Estimate"("serviceRequestId");

-- CreateIndex
CREATE INDEX "EstimateRevision_estimateId_status_revisionNumber_idx" ON "EstimateRevision"("estimateId", "status", "revisionNumber");

-- CreateIndex
CREATE INDEX "EstimateRevision_approvedByUserId_idx" ON "EstimateRevision"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateRevision_estimateId_revisionNumber_key" ON "EstimateRevision"("estimateId", "revisionNumber");

-- CreateIndex
CREATE INDEX "EstimateLineItem_revisionId_idx" ON "EstimateLineItem"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateLineItem_revisionId_sortOrder_key" ON "EstimateLineItem"("revisionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_sourceLineId_key" ON "InvoiceLine"("sourceLineId");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_sortOrder_key" ON "InvoiceLine"("invoiceId", "sortOrder");

-- CreateIndex
CREATE INDEX "InspectionTemplate_organizationId_serviceType_isActive_idx" ON "InspectionTemplate"("organizationId", "serviceType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTemplate_organizationId_name_key" ON "InspectionTemplate"("organizationId", "name");

-- CreateIndex
CREATE INDEX "InspectionTemplateItem_templateId_idx" ON "InspectionTemplateItem"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTemplateItem_templateId_sortOrder_key" ON "InspectionTemplateItem"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_serviceRequestId_key" ON "Booking"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_estimateRevisionId_key" ON "Booking"("estimateRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_estimateRevisionId_key" ON "Invoice"("estimateRevisionId");

-- AddForeignKey
ALTER TABLE "ServiceSite" ADD CONSTRAINT "ServiceSite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSite" ADD CONSTRAINT "ServiceSite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceSiteId_fkey" FOREIGN KEY ("serviceSiteId") REFERENCES "ServiceSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_inspectionTemplateId_fkey" FOREIGN KEY ("inspectionTemplateId") REFERENCES "InspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_estimateRevisionId_fkey" FOREIGN KEY ("estimateRevisionId") REFERENCES "EstimateRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_estimateRevisionId_fkey" FOREIGN KEY ("estimateRevisionId") REFERENCES "EstimateRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_serviceSiteId_fkey" FOREIGN KEY ("serviceSiteId") REFERENCES "ServiceSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceSiteId_fkey" FOREIGN KEY ("serviceSiteId") REFERENCES "ServiceSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateRevision" ADD CONSTRAINT "EstimateRevision_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateRevision" ADD CONSTRAINT "EstimateRevision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateRevision" ADD CONSTRAINT "EstimateRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "EstimateRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_sourceLineId_fkey" FOREIGN KEY ("sourceLineId") REFERENCES "EstimateLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
