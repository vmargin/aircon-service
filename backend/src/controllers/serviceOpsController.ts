import { Request, Response } from 'express';
import {
    BookingPriority,
    BookingStatus,
    EstimateApprovalMethod,
    EstimateStatus,
    Prisma,
    ServiceRequestStatus,
    UserRole,
} from '@prisma/client';
import { z } from 'zod';
import prisma from '../db/prisma';
import { auditInTransaction } from '../lib/auditLog';
import { BOOKING_INCLUDE, serializeBooking } from '../lib/bookingView';
import { assertDispatchAvailable } from '../lib/dispatch';
import { assertBranchInScope, assertCustomerInScope, assertUnitInScope, isBranchScoped, lockServiceSiteForLink } from '../lib/tenancy';
import { costField } from '../lib/money';
import { MAX_ESTIMATE_TOTAL, roundEstimateLineTotal, sumEstimateLineTotals } from '../lib/estimateMoney';
import { checklistSnapshot, loadInspectionTemplate } from '../lib/inspectionTemplates';
import { parsePagination, toPage } from '../lib/pagination';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { requireUser } from '../middleware/auth';

const siteFields = {
    customerId: z.string().uuid(),
    branchId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().min(3).max(500),
    contactName: z.string().trim().max(120).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    accessNotes: z.string().trim().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
};
const createSiteSchema = z.object(siteFields);
const updateSiteSchema = z.object({
    branchId: z.string().uuid().nullable(),
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().min(3).max(500),
    contactName: z.string().trim().max(120).nullable(),
    phone: z.string().trim().max(40).nullable(),
    accessNotes: z.string().trim().max(1000).nullable(),
    isActive: z.boolean(),
}).partial().refine((value) => Object.keys(value).length > 0, 'Enter at least one site change.');
const siteListSchema = z.object({
    customerId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    includeInactive: z.enum(['true', 'false']).optional(),
});

const requestFields = {
    branchId: z.string().uuid(),
    customerId: z.string().uuid(),
    serviceSiteId: z.string().uuid().nullable().optional(),
    unitId: z.string().uuid().nullable().optional(),
    serviceAddress: z.string().trim().max(500).optional(),
    serviceType: z.string().trim().min(1).max(120),
    reportedIssue: z.string().trim().min(3).max(2000),
    priority: z.nativeEnum(BookingPriority).default(BookingPriority.NORMAL),
    preferredWindowStart: z.string().datetime().nullable().optional(),
    preferredWindowEnd: z.string().datetime().nullable().optional(),
    accessNotes: z.string().trim().max(1000).nullable().optional(),
    internalNotes: z.string().trim().max(2000).nullable().optional(),
};
const createRequestSchema = z.object(requestFields).superRefine((data, context) => {
    if (Boolean(data.preferredWindowStart) !== Boolean(data.preferredWindowEnd)) {
        context.addIssue({ code: 'custom', message: 'Provide both ends of the preferred arrival window, or leave both blank.', path: ['preferredWindowEnd'] });
    }
    if (data.preferredWindowStart && data.preferredWindowEnd && new Date(data.preferredWindowStart) >= new Date(data.preferredWindowEnd)) {
        context.addIssue({ code: 'custom', message: 'The preferred window end must be after its start.', path: ['preferredWindowEnd'] });
    }
});
const updateRequestSchema = z.object({
    status: z.nativeEnum(ServiceRequestStatus).refine((value) => value !== ServiceRequestStatus.CONVERTED),
    internalNotes: z.string().trim().max(2000).nullable().optional(),
    serviceSiteId: z.string().uuid().nullable().optional(),
    unitId: z.string().uuid().nullable().optional(),
}).partial().refine((value) => Object.keys(value).length > 0, 'Enter at least one request change.');
const requestListSchema = z.object({
    status: z.nativeEnum(ServiceRequestStatus).optional(),
    branchId: z.string().uuid().optional(),
    q: z.string().trim().max(100).optional(),
});
const convertRequestSchema = z.object({
    scheduledAt: z.string().datetime(),
    technicianId: z.string().uuid().nullable().optional(),
    durationMinutes: z.number().int().min(30).max(480).default(120),
    inspectionTemplateId: z.string().uuid().nullable().optional(),
});

const estimateLineSchema = z.object({
    description: z.string().trim().min(1).max(160),
    quantity: z.union([z.number(), z.string()]).transform(String)
        .refine((value) => /^\d{1,7}(?:\.\d{1,3})?$/.test(value) && new Prisma.Decimal(value).gt(0), 'Enter a positive quantity with up to three decimal places.'),
    unitPrice: costField,
});
const saveEstimateSchema = z.object({
    notes: z.string().trim().max(2000).nullable().optional(),
    lineItems: z.array(estimateLineSchema).min(1).max(40),
});
const approvalSchema = z.object({
    method: z.nativeEnum(EstimateApprovalMethod),
    contact: z.string().trim().min(1).max(120),
    note: z.string().trim().max(1000).nullable().optional(),
});
const declineSchema = z.object({ note: z.string().trim().max(1000).nullable().optional() });

const SITE_INCLUDE = { branch: true, customer: true } satisfies Prisma.ServiceSiteInclude;
const REQUEST_INCLUDE = {
    branch: true,
    customer: true,
    serviceSite: true,
    unit: true,
    booking: { select: { id: true, status: true, scheduledAt: true } },
    estimate: {
        include: {
            revisions: {
                orderBy: { revisionNumber: 'desc' as const },
                include: { lineItems: { orderBy: { sortOrder: 'asc' as const } } },
            },
        },
    },
} satisfies Prisma.ServiceRequestInclude;
const REQUEST_BOOKING_INCLUDE = { ...BOOKING_INCLUDE, serviceSite: true } satisfies Prisma.BookingInclude;

function requestScope(user: ReturnType<typeof requireUser>): Prisma.ServiceRequestWhereInput {
    return {
        organizationId: user.orgId,
        ...(isBranchScoped(user) ? { branchId: user.branchId } : {}),
    };
}

function allowedRequestTransition(from: ServiceRequestStatus, to: ServiceRequestStatus) {
    const allowed: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
        [ServiceRequestStatus.NEW]: [ServiceRequestStatus.NEEDS_ASSESSMENT, ServiceRequestStatus.READY_TO_SCHEDULE, ServiceRequestStatus.CLOSED],
        [ServiceRequestStatus.NEEDS_ASSESSMENT]: [ServiceRequestStatus.READY_TO_SCHEDULE, ServiceRequestStatus.CLOSED],
        [ServiceRequestStatus.READY_TO_SCHEDULE]: [ServiceRequestStatus.NEEDS_ASSESSMENT, ServiceRequestStatus.CLOSED],
        [ServiceRequestStatus.CONVERTED]: [],
        [ServiceRequestStatus.CLOSED]: [],
    };
    if (from !== to && !allowed[from].includes(to)) {
        throw new ValidationError(`Cannot move a request from ${from} to ${to}.`);
    }
}

function lineItemsForWrite(data: z.infer<typeof saveEstimateSchema>['lineItems']) {
    return data.map((line, sortOrder) => {
        const quantity = new Prisma.Decimal(line.quantity);
        const lineTotal = roundEstimateLineTotal(quantity, line.unitPrice);
        return {
            description: line.description,
            quantity,
            unitPrice: line.unitPrice,
            lineTotal,
            sortOrder,
        };
    });
}

function serializeRevision<T extends { lineItems: Array<{ quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal }> }>(revision: T) {
    const total = revision.lineItems.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
    return {
        ...revision,
        total: total.toFixed(2),
        lineItems: revision.lineItems.map((line) => ({
            ...line,
            quantity: line.quantity.toFixed(3),
            unitPrice: line.unitPrice.toFixed(2),
            lineTotal: line.lineTotal.toFixed(2),
        })),
    };
}

export const getServiceSites = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = siteListSchema.parse(req.query);
    const where: Prisma.ServiceSiteWhereInput = {
        organizationId: user.orgId,
        ...(isBranchScoped(user) ? { branchId: user.branchId } : filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.includeInactive === 'true' && user.role === UserRole.ADMIN ? {} : { isActive: true }),
    };
    const [sites, total] = await prisma.$transaction([
        prisma.serviceSite.findMany({ where, include: SITE_INCLUDE, orderBy: [{ customer: { name: 'asc' } }, { name: 'asc' }], skip, take }),
        prisma.serviceSite.count({ where }),
    ]);
    res.json(toPage(sites, total, page, limit));
};

export const createServiceSite = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = createSiteSchema.parse(req.body);
    const site = await prisma.$transaction(async (tx) => {
        await assertCustomerInScope(user, data.customerId, tx);
        const branchId = isBranchScoped(user) ? user.branchId : data.branchId;
        if (!branchId) throw new ValidationError('Choose the branch responsible for this service site.');
        await assertBranchInScope(user, branchId, tx);
        const created = await tx.serviceSite.create({
            data: {
                ...data,
                branchId,
                organizationId: user.orgId,
                contactName: data.contactName || null,
                phone: data.phone || null,
                accessNotes: data.accessNotes || null,
            },
            include: SITE_INCLUDE,
        });
        await auditInTransaction(tx, req, 'SERVICE_SITE_CREATE', 'service_site', created.id, created.branchId, `Created ${created.name} for ${created.customer.name}`);
        return created;
    });
    res.status(201).json(site);
};

export const updateServiceSite = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = updateSiteSchema.parse(req.body);
    const site = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ServiceSite" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const current = await tx.serviceSite.findFirst({
            where: { id: req.params.id, organizationId: user.orgId, ...(isBranchScoped(user) ? { branchId: user.branchId } : {}) },
        });
        if (!current) throw new NotFoundError('Service site not found');
        if (data.branchId !== undefined && user.role !== UserRole.ADMIN) {
            throw new ForbiddenError('Only an administrator can reassign a service site to another branch.');
        }
        if (data.branchId !== undefined && data.branchId !== current.branchId) {
            const siteHistory = { OR: [
                { serviceSiteId: current.id },
                { unit: { is: { serviceSiteId: current.id } } },
            ] };
            const [bookingHistory, requestHistory] = await Promise.all([
                tx.booking.count({ where: siteHistory }),
                tx.serviceRequest.count({ where: siteHistory }),
            ]);
            if (bookingHistory > 0 || requestHistory > 0) {
                throw new ConflictError('A service site with recorded service history cannot move branches. Create a new site for future visits.');
            }
        }
        if (data.branchId) await assertBranchInScope(user, data.branchId, tx);
        const updated = await tx.serviceSite.update({
            where: { id: current.id },
            data: {
                ...data,
                ...(data.contactName !== undefined ? { contactName: data.contactName || null } : {}),
                ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
                ...(data.accessNotes !== undefined ? { accessNotes: data.accessNotes || null } : {}),
            },
            include: SITE_INCLUDE,
        });
        await auditInTransaction(tx, req, 'SERVICE_SITE_UPDATE', 'service_site', updated.id, updated.branchId, `Updated ${updated.name}`);
        return updated;
    });
    res.json(site);
};

export const getServiceRequests = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = requestListSchema.parse(req.query);
    const where: Prisma.ServiceRequestWhereInput = { ...requestScope(user) };
    if (filters.status) where.status = filters.status;
    if (filters.branchId && user.role === UserRole.ADMIN) where.branchId = filters.branchId;
    if (filters.q) {
        where.OR = [
            { serviceType: { contains: filters.q, mode: 'insensitive' } },
            { reportedIssue: { contains: filters.q, mode: 'insensitive' } },
            { customer: { name: { contains: filters.q, mode: 'insensitive' } } },
            { customer: { phone: { contains: filters.q } } },
        ];
    }
    const [requests, total] = await prisma.$transaction([
        prisma.serviceRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.serviceRequest.count({ where }),
    ]);
    res.json(toPage(requests.map((request) => ({
        ...request,
        estimate: request.estimate ? {
            ...request.estimate,
            revisions: request.estimate.revisions.map(serializeRevision),
        } : null,
    })), total, page, limit));
};

export const createServiceRequest = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = createRequestSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
        await assertBranchInScope(user, data.branchId, tx);
        await assertCustomerInScope(user, data.customerId, tx);

        const unitId = data.unitId || null;
        const unit = await assertUnitInScope(user, data.customerId, unitId, tx);

        const selectedSiteId = data.serviceSiteId || unit?.serviceSiteId || null;
        if (unit?.serviceSiteId && selectedSiteId !== unit.serviceSiteId) {
            throw new ValidationError('The selected unit belongs to a different service site.');
        }
        if (selectedSiteId) await lockServiceSiteForLink(tx, selectedSiteId);
        const site = selectedSiteId ? await tx.serviceSite.findFirst({
            where: { id: selectedSiteId, organizationId: user.orgId, branchId: data.branchId, customerId: data.customerId, isActive: true },
        }) : null;
        if (selectedSiteId && !site) throw new ValidationError('Choose an active service site registered to this customer.');
        const serviceAddress = site?.address ?? data.serviceAddress?.trim();
        if (!serviceAddress) throw new ValidationError('Enter a service address or select a service site.');

        const created = await tx.serviceRequest.create({
            data: {
                organizationId: user.orgId,
                branchId: data.branchId,
                customerId: data.customerId,
                serviceSiteId: site?.id ?? null,
                unitId,
                serviceAddress,
                serviceType: data.serviceType,
                reportedIssue: data.reportedIssue,
                priority: data.priority,
                preferredWindowStart: data.preferredWindowStart ? new Date(data.preferredWindowStart) : null,
                preferredWindowEnd: data.preferredWindowEnd ? new Date(data.preferredWindowEnd) : null,
                accessNotes: data.accessNotes || site?.accessNotes || null,
                internalNotes: data.internalNotes || null,
                createdByUserId: user.userId,
            },
            include: REQUEST_INCLUDE,
        });
        await auditInTransaction(tx, req, 'SERVICE_REQUEST_CREATE', 'service_request', created.id, created.branchId, `${created.serviceType} for ${created.customer.name}`);
        return created;
    });
    res.status(201).json(result);
};

export const updateServiceRequest = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = updateRequestSchema.parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const current = await tx.serviceRequest.findFirst({ where: { id: req.params.id, ...requestScope(user) } });
        if (!current) throw new NotFoundError('Service request not found');
        if (data.status) allowedRequestTransition(current.status, data.status);
        if (current.status === ServiceRequestStatus.CONVERTED || current.status === ServiceRequestStatus.CLOSED) {
            if (Object.keys(data).some((key) => key !== 'status' || data.status !== current.status)) {
                throw new ValidationError('Closed or converted requests cannot be edited.');
            }
        }

        const hasSiteChange = data.serviceSiteId !== undefined;
        const hasUnitChange = data.unitId !== undefined;
        let linkageUpdate: Prisma.ServiceRequestUncheckedUpdateInput = {};
        if (hasSiteChange || hasUnitChange) {
            await assertBranchInScope(user, current.branchId, tx);
            await assertCustomerInScope(user, current.customerId, tx);

            const unitId = hasUnitChange ? data.unitId : current.unitId;
            const unit = await assertUnitInScope(user, current.customerId, unitId, tx);

            // Match request creation: when a unit is supplied without an explicit
            // site, use its registered site when it has one. Otherwise retain the
            // request's current site so an unlinked unit can still be serviced there.
            const serviceSiteId = hasSiteChange
                ? data.serviceSiteId
                : hasUnitChange && unit?.serviceSiteId
                    ? unit.serviceSiteId
                    : current.serviceSiteId;
            if (unit?.serviceSiteId && unit.serviceSiteId !== serviceSiteId) {
                throw new ValidationError('The selected unit belongs to a different service site. Update the unit and service site together.');
            }
            if (serviceSiteId) await lockServiceSiteForLink(tx, serviceSiteId);
            const site = serviceSiteId ? await tx.serviceSite.findFirst({
                where: {
                    id: serviceSiteId,
                    organizationId: user.orgId,
                    branchId: current.branchId,
                    customerId: current.customerId,
                    isActive: true,
                },
                select: { id: true, address: true, accessNotes: true },
            }) : null;
            if (serviceSiteId && !site) {
                throw new ValidationError('Choose an active service site in this request’s branch registered to this customer.');
            }

            linkageUpdate = {
                serviceSiteId: site?.id ?? null,
                unitId: unit?.id ?? null,
                ...(site ? {
                    serviceAddress: site.address,
                    ...(hasSiteChange && data.serviceSiteId ? { accessNotes: site.accessNotes } : {}),
                } : {}),
            };
        }

        const requestChanges: Prisma.ServiceRequestUncheckedUpdateInput = {
            ...(data.status !== undefined ? { status: data.status } : {}),
            ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes } : {}),
        };
        const result = await tx.serviceRequest.update({
            where: { id: current.id },
            data: { ...requestChanges, ...linkageUpdate },
            include: REQUEST_INCLUDE,
        });
        const auditDetails = data.status
            ? [`Status ${current.status} → ${data.status}`]
            : data.internalNotes !== undefined ? ['Updated internal request notes'] : [];
        const updatedLinks = [
            result.serviceSiteId !== current.serviceSiteId ? 'service site' : null,
            result.unitId !== current.unitId ? 'unit' : null,
        ].filter((value): value is string => value !== null);
        if (updatedLinks.length) auditDetails.push(`Updated ${updatedLinks.join(' and ')} link${updatedLinks.length > 1 ? 's' : ''}`);
        await auditInTransaction(
            tx,
            req,
            'SERVICE_REQUEST_UPDATE',
            'service_request',
            result.id,
            result.branchId,
            auditDetails.join('; ') || 'Confirmed service request links',
        );
        return result;
    });
    res.json(updated);
};

export const saveServiceRequestEstimate = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = saveEstimateSchema.parse(req.body);
    const lineItems = lineItemsForWrite(data.lineItems);
    if (sumEstimateLineTotals(lineItems.map((line) => line.lineTotal)).gt(MAX_ESTIMATE_TOTAL)) {
        throw new ValidationError('The estimate total exceeds the supported invoice amount.');
    }
    const saved = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const request = await tx.serviceRequest.findFirst({
            where: { id: req.params.id, ...requestScope(user) },
            include: { estimate: { include: { revisions: { orderBy: { revisionNumber: 'desc' }, include: { lineItems: true } } } } },
        });
        if (!request) throw new NotFoundError('Service request not found');
        if (request.status === ServiceRequestStatus.CONVERTED || request.status === ServiceRequestStatus.CLOSED) {
            throw new ValidationError('Estimates cannot be changed for a closed or converted request.');
        }
        const estimateId = request.estimate?.id ?? (await tx.estimate.create({ data: { serviceRequestId: request.id } })).id;

        const latest = request.estimate?.revisions[0];
        const now = new Date();
        let revisionId: string;
        let revisionNumber: number;
        if (latest && latest.status === EstimateStatus.DRAFT && latest.supersededAt === null) {
            await tx.estimateLineItem.deleteMany({ where: { revisionId: latest.id } });
            await tx.estimateRevision.update({ where: { id: latest.id }, data: { notes: data.notes || null } });
            revisionId = latest.id;
            revisionNumber = latest.revisionNumber;
        } else {
            if (latest) await tx.estimateRevision.update({ where: { id: latest.id }, data: { supersededAt: now } });
            revisionNumber = (latest?.revisionNumber ?? 0) + 1;
            const revision = await tx.estimateRevision.create({
                data: {
                    estimateId,
                    revisionNumber,
                    notes: data.notes || null,
                    createdByUserId: user.userId,
                },
            });
            revisionId = revision.id;
        }
        await tx.estimateLineItem.createMany({ data: lineItems.map((line) => ({ ...line, revisionId })) });
        const revision = await tx.estimateRevision.findUniqueOrThrow({
            where: { id: revisionId },
            include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
        });
        await auditInTransaction(tx, req, 'ESTIMATE_DRAFT_SAVE', 'estimate_revision', revision.id, request.branchId, `Saved estimate revision ${revisionNumber}`);
        return serializeRevision(revision);
    });
    res.status(201).json(saved);
};

async function loadScopedCurrentRevision(
    tx: Prisma.TransactionClient,
    requestId: string,
    revisionId: string,
    user: ReturnType<typeof requireUser>,
) {
    const request = await tx.serviceRequest.findFirst({
        where: { id: requestId, ...requestScope(user) },
        include: { estimate: { include: { revisions: { orderBy: { revisionNumber: 'desc' }, include: { lineItems: { orderBy: { sortOrder: 'asc' } } } } } } },
    });
    if (!request) throw new NotFoundError('Estimate not found');
    if (request.status === ServiceRequestStatus.CONVERTED || request.status === ServiceRequestStatus.CLOSED) {
        throw new ValidationError('Estimates cannot be changed for a closed or converted request.');
    }
    const current = request.estimate?.revisions[0];
    if (!current || current.id !== revisionId || current.supersededAt) throw new ConflictError('This estimate revision is no longer current.');
    return { request, current };
}

export const sendEstimate = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const updated = await prisma.$transaction(async (tx) => {
        const pointer = await tx.estimateRevision.findUnique({ where: { id: req.params.id }, select: { estimate: { select: { serviceRequestId: true } } } });
        if (!pointer) throw new NotFoundError('Estimate revision not found');
        const requestId = pointer.estimate.serviceRequestId;
        await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE`;
        const { request, current } = await loadScopedCurrentRevision(tx, requestId, req.params.id, user);
        if (current.status !== EstimateStatus.DRAFT || current.lineItems.length === 0) throw new ValidationError('Only a non-empty draft estimate can be marked as sent.');
        const revision = await tx.estimateRevision.update({ where: { id: current.id }, data: { status: EstimateStatus.SENT, sentAt: new Date() }, include: { lineItems: { orderBy: { sortOrder: 'asc' } } } });
        await auditInTransaction(tx, req, 'ESTIMATE_SENT', 'estimate_revision', revision.id, request.branchId, `Marked estimate revision ${revision.revisionNumber} as sent`);
        return serializeRevision(revision);
    });
    res.json(updated);
};

export const approveEstimate = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = approvalSchema.parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
        const pointer = await tx.estimateRevision.findUnique({ where: { id: req.params.id }, select: { estimate: { select: { serviceRequestId: true } } } });
        if (!pointer) throw new NotFoundError('Estimate revision not found');
        const requestId = pointer.estimate.serviceRequestId;
        await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE`;
        const { request, current } = await loadScopedCurrentRevision(tx, requestId, req.params.id, user);
        if (current.status !== EstimateStatus.SENT) throw new ValidationError('Only a sent estimate revision can be approved.');
        const revision = await tx.estimateRevision.update({
            where: { id: current.id },
            data: {
                status: EstimateStatus.APPROVED,
                approvedAt: new Date(),
                approvalMethod: data.method,
                approvalContact: data.contact,
                approvalNote: data.note || null,
                approvedByUserId: user.userId,
            },
            include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
        });
        if (request.status !== ServiceRequestStatus.READY_TO_SCHEDULE) {
            await tx.serviceRequest.update({ where: { id: request.id }, data: { status: ServiceRequestStatus.READY_TO_SCHEDULE } });
        }
        await auditInTransaction(tx, req, 'ESTIMATE_APPROVE', 'estimate_revision', revision.id, request.branchId, `Recorded approval by ${data.contact} via ${data.method}`);
        return serializeRevision(revision);
    });
    res.json(updated);
};

export const declineEstimate = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = declineSchema.parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
        const pointer = await tx.estimateRevision.findUnique({ where: { id: req.params.id }, select: { estimate: { select: { serviceRequestId: true } } } });
        if (!pointer) throw new NotFoundError('Estimate revision not found');
        const requestId = pointer.estimate.serviceRequestId;
        await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE`;
        const { request, current } = await loadScopedCurrentRevision(tx, requestId, req.params.id, user);
        if (current.status !== EstimateStatus.SENT) throw new ValidationError('Only a sent estimate revision can be declined.');
        const revision = await tx.estimateRevision.update({
            where: { id: current.id },
            data: { status: EstimateStatus.DECLINED, decisionNote: data.note || null },
            include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
        });
        await auditInTransaction(tx, req, 'ESTIMATE_DECLINE', 'estimate_revision', revision.id, request.branchId, 'Recorded estimate decline');
        return serializeRevision(revision);
    });
    res.json(updated);
};

export const convertServiceRequest = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = convertRequestSchema.parse(req.body);
    let createdNew = false;
    const booking = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const request = await tx.serviceRequest.findFirst({
            where: { id: req.params.id, ...requestScope(user) },
            include: {
                booking: true,
                estimate: { include: { revisions: { orderBy: { revisionNumber: 'desc' }, include: { lineItems: true } } } },
            },
        });
        if (!request) throw new NotFoundError('Service request not found');
        if (request.booking) return tx.booking.findUniqueOrThrow({ where: { id: request.booking.id }, include: REQUEST_BOOKING_INCLUDE });
        if (request.status !== ServiceRequestStatus.READY_TO_SCHEDULE) throw new ValidationError('Mark the request ready to schedule before converting it to a service job.');
        await assertBranchInScope(user, request.branchId, tx);
        await assertCustomerInScope(user, request.customerId, tx);
        const unit = request.unitId
            ? await assertUnitInScope(user, request.customerId, request.unitId, tx)
            : null;
        if (request.unitId && !unit) throw new ValidationError('The requested unit is no longer registered to this customer and service branch.');
        if (unit?.serviceSiteId && unit.serviceSiteId !== request.serviceSiteId) {
            throw new ValidationError('The requested unit is now linked to another service site. Update the request before scheduling.');
        }
        if (request.serviceSiteId) {
            await lockServiceSiteForLink(tx, request.serviceSiteId);
            const site = await tx.serviceSite.findFirst({ where: { id: request.serviceSiteId, organizationId: user.orgId, branchId: request.branchId, customerId: request.customerId, isActive: true } });
            if (!site) throw new ValidationError('Reactivate or replace the service site before scheduling this request.');
        }
        const template = await loadInspectionTemplate(tx, user.orgId, request.serviceType, data.inspectionTemplateId);
        const latest = request.estimate?.revisions[0];
        if (request.estimate && (!latest || latest.status !== EstimateStatus.APPROVED || latest.supersededAt)) {
            throw new ValidationError('The latest estimate must be approved before this request can be scheduled.');
        }
        const scheduledAt = new Date(data.scheduledAt);
        if (data.technicianId) await assertDispatchAvailable(tx, user, data.technicianId, request.branchId, scheduledAt, data.durationMinutes);
        else await assertBranchInScope(user, request.branchId, tx);
        const created = await tx.booking.create({
            data: {
                serviceType: request.serviceType,
                status: BookingStatus.PENDING,
                scheduledAt,
                customerId: request.customerId,
                branchId: request.branchId,
                technicianId: data.technicianId || null,
                unitId: request.unitId,
                serviceSiteId: request.serviceSiteId,
                serviceAddress: request.serviceAddress,
                accessNotes: request.accessNotes,
                notes: request.internalNotes,
                priority: request.priority,
                durationMinutes: data.durationMinutes,
                inspectionTemplateId: template?.id ?? null,
                serviceRequestId: request.id,
                estimateRevisionId: latest?.id,
                ...(template ? { checklist: checklistSnapshot(template) } : {}),
            },
            include: REQUEST_BOOKING_INCLUDE,
        });
        await tx.serviceRequest.update({ where: { id: request.id }, data: { status: ServiceRequestStatus.CONVERTED } });
        await auditInTransaction(tx, req, 'SERVICE_REQUEST_CONVERT', 'service_request', request.id, request.branchId, `Converted to work order ${created.id}`);
        await auditInTransaction(tx, req, 'BOOKING_CREATE', 'booking', created.id, created.branchId, `${created.serviceType} for ${created.customer.name}`);
        createdNew = true;
        return created;
    }, { maxWait: 10_000, timeout: 15_000 });
    res.status(createdNew ? 201 : 200).json(serializeBooking(booking));
};
