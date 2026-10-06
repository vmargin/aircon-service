import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../db/prisma';
import { requireUser } from '../middleware/auth';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { auditInTransaction } from '../lib/auditLog';
import { assertCustomerInScope, branchScopedUnitWhere, isBranchScoped, lockServiceSiteForLink } from '../lib/tenancy';
import { parsePagination, toPage } from '../lib/pagination';

const schema = z.object({
    customerId: z.string().uuid(), name: z.string().trim().min(2).max(120), brand: z.string().trim().min(1).max(80),
    model: z.string().trim().max(100).nullable().optional(), serialNumber: z.string().trim().max(100).nullable().optional(),
    type: z.string().trim().min(1).max(80).optional(), capacity: z.string().trim().max(80).nullable().optional(),
    location: z.string().trim().max(300).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(),
    serviceSiteId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
    installedAt: z.string().datetime().nullable().optional(), nextMaintenanceAt: z.string().datetime().nullable().optional(),
});
const listSchema = z.object({ customerId: z.string().uuid().optional(), search: z.string().trim().max(100).optional() });
async function assertServiceSite(tx: Prisma.TransactionClient, user: ReturnType<typeof requireUser>, customerId: string, serviceSiteId?: string | null) {
    if (!serviceSiteId) return null;
    await lockServiceSiteForLink(tx, serviceSiteId);
    const site = await tx.serviceSite.findFirst({
        where: {
            id: serviceSiteId,
            organizationId: user.orgId,
            customerId,
            isActive: true,
            ...(isBranchScoped(user) ? { branchId: user.branchId } : {}),
        },
    });
    if (!site) throw new ValidationError('Choose an active service site registered to this customer.');
    return site;
}
function dates<T extends { installedAt?: string | null; nextMaintenanceAt?: string | null }>(data: T) {
    return { ...data, installedAt: data.installedAt ? new Date(data.installedAt) : data.installedAt, nextMaintenanceAt: data.nextMaintenanceAt ? new Date(data.nextMaintenanceAt) : data.nextMaintenanceAt };
}

export const getUnits = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const { customerId, search } = listSchema.parse(req.query);
    const branchScoped = isBranchScoped(user);
    const predicates: Prisma.UnitWhereInput[] = [];
    if (branchScoped) predicates.push(branchScopedUnitWhere(user));
    if (search) {
        predicates.push({
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
            ],
        });
    }
    const where: Prisma.UnitWhereInput = {
        organizationId: user.orgId,
        ...(customerId ? { customerId } : {}),
        ...(predicates.length ? { AND: predicates } : {}),
    };
    const [units, total] = await prisma.$transaction([
        prisma.unit.findMany({
            where,
            include: {
                customer: true,
                serviceSite: true,
                _count: { select: { bookings: branchScoped ? { where: { branchId: user.branchId } } : true } },
            },
            orderBy: { name: 'asc' }, skip, take,
        }),
        prisma.unit.count({ where }),
    ]);
    const visibleUnits = branchScoped
        ? units.map((unit) => unit.serviceSite?.branchId !== user.branchId
            ? { ...unit, serviceSite: null, serviceSiteId: null }
            : unit)
        : units;
    res.json(toPage(visibleUnits, total, page, limit));
};

export const createUnit = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = schema.parse(req.body);
    const unit = await prisma.$transaction(async (tx) => {
        await assertCustomerInScope(user, data.customerId, tx);
        const requestedSiteId = data.serviceSiteId || null;
        if (isBranchScoped(user) && !requestedSiteId) {
            throw new ValidationError('Choose an active service site in your branch for this unit.');
        }
        const site = await assertServiceSite(tx, user, data.customerId, requestedSiteId);
        const result = await tx.unit.create({ data: { ...dates(data), serviceSiteId: site?.id ?? null, organizationId: user.orgId }, include: { customer: true, serviceSite: true } });
        await auditInTransaction(tx, req, 'UNIT_CREATE', 'unit', result.id, user.branchId, `${result.name} registered to ${result.customer.name}`);
        return result;
    });
    res.status(201).json(unit);
};

export const updateUnit = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = schema.partial().parse(req.body);
    const unit = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const existing = await tx.unit.findFirst({
            where: { id: req.params.id, organizationId: user.orgId, ...(isBranchScoped(user) ? branchScopedUnitWhere(user) : {}) },
            include: {
                serviceSite: { select: { branchId: true } },
                _count: { select: { bookings: true, serviceRequests: true } },
            },
        });
        if (!existing) throw new NotFoundError('Unit not found');
        if (data.customerId && data.customerId !== existing.customerId) {
            if (existing._count.bookings + existing._count.serviceRequests > 0) throw new ValidationError('A unit with service history cannot be transferred to another customer.');
            await assertCustomerInScope(user, data.customerId, tx);
        }
        const customerId = data.customerId ?? existing.customerId;
        const changingCustomer = customerId !== existing.customerId;
        const serviceSiteId = data.serviceSiteId === undefined
            ? (changingCustomer ? null : existing.serviceSiteId)
            : data.serviceSiteId || null;
        if (isBranchScoped(user) && !serviceSiteId) {
            throw new ValidationError('Choose an active service site in your branch for this unit.');
        }
        const site = await assertServiceSite(tx, user, customerId, serviceSiteId);
        if (serviceSiteId !== existing.serviceSiteId && existing._count.bookings + existing._count.serviceRequests > 0) {
            const history = await tx.unit.findUniqueOrThrow({
                where: { id: existing.id },
                select: {
                    bookings: { select: { branchId: true } },
                    serviceRequests: { select: { branchId: true } },
                },
            });
            const historyBranches = new Set([
                ...history.bookings.map((booking) => booking.branchId),
                ...history.serviceRequests.map((serviceRequest) => serviceRequest.branchId),
            ]);
            const targetBranchId = site?.branchId ?? null;
            if (historyBranches.size > 1 || (targetBranchId && [...historyBranches].some((branchId) => branchId !== targetBranchId))) {
                throw new ConflictError('This unit has service history in another branch and cannot be reassigned there.');
            }
        }
        const result = await tx.unit.update({ where: { id: existing.id }, data: { ...dates(data), serviceSiteId: site?.id ?? null }, include: { customer: true, serviceSite: true } });
        await auditInTransaction(tx, req, 'UNIT_UPDATE', 'unit', result.id, user.branchId, `Updated ${result.name}`);
        return result;
    });
    res.json(unit);
};
