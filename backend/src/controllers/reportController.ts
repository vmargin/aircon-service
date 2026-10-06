import { Request, Response } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import { z } from 'zod';
import prisma from '../db/prisma';
import { branchScopedUnitWhere, branchScopedWhere, isBranchScoped } from '../lib/tenancy';
import { parsePagination, toPage } from '../lib/pagination';
import { requireUser } from '../middleware/auth';
import { assertBranchInScope } from '../lib/tenancy';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a Manila calendar date (YYYY-MM-DD).').refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');
const reportFilters = z.object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    branchId: z.string().uuid().optional(),
}).superRefine((data, context) => {
    if (data.from && data.to && data.from > data.to) {
        context.addIssue({ code: 'custom', message: 'The start date must be on or before the end date.', path: ['from'] });
    }
});

function manilaDay(value = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(value);
}

function reportRange(from?: string, to?: string) {
    return {
        ...(from ? { gte: new Date(`${from}T00:00:00.000+08:00`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999+08:00`) } : {}),
    };
}

export const getPartsUsageReport = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = reportFilters.parse(req.query);
    if (filters.branchId) await assertBranchInScope(user, filters.branchId);
    const bookingWhere: Prisma.BookingWhereInput = { ...branchScopedWhere(user) };
    if (filters.branchId && user.role === UserRole.ADMIN) bookingWhere.branchId = filters.branchId;
    const where: Prisma.PartUsageWhereInput = {
        booking: bookingWhere,
        ...(filters.from || filters.to ? { createdAt: reportRange(filters.from, filters.to) } : {}),
    };
    const [usage, total] = await prisma.$transaction([
        prisma.partUsage.findMany({
            where,
            include: {
                inventoryItem: { select: { name: true, sku: true, unit: true } },
                booking: { select: { id: true, serviceType: true, scheduledAt: true, customer: { select: { name: true } }, branch: { select: { id: true, name: true } } } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        }),
        prisma.partUsage.count({ where }),
    ]);
    res.json(toPage(usage.map((row) => {
        const { unitPrice, ...rest } = row;
        return {
            ...rest,
            unitCost: unitPrice.toFixed(2),
            extendedCost: new Prisma.Decimal(row.quantity).mul(unitPrice).toFixed(2),
        };
    }), total, page, limit));
};

export const getMaintenanceDueReport = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = reportFilters.parse(req.query);
    if (filters.branchId) await assertBranchInScope(user, filters.branchId);
    const branchScoped = isBranchScoped(user);
    const scopedBranchId = branchScoped ? user.branchId : filters.branchId;
    const through = filters.to ?? manilaDay();
    const nextMaintenanceAt = reportRange(filters.from, through);
    const attributionScope: Prisma.UnitWhereInput = branchScoped
        ? branchScopedUnitWhere(user)
        : scopedBranchId ? {
            OR: [
                { serviceSite: { is: { organizationId: user.orgId, branchId: scopedBranchId } } },
                { bookings: { some: { branchId: scopedBranchId } } },
                { serviceRequests: { some: { organizationId: user.orgId, branchId: scopedBranchId } } },
            ],
        } : {};
    const where: Prisma.UnitWhereInput = {
        organizationId: user.orgId,
        nextMaintenanceAt,
        ...attributionScope,
    };
    const [units, total] = await prisma.$transaction([
        prisma.unit.findMany({
            where,
            include: {
                customer: true,
                serviceSite: true,
                _count: { select: { bookings: scopedBranchId ? { where: { branchId: scopedBranchId } } : true } },
            },
            orderBy: [{ nextMaintenanceAt: 'asc' }, { name: 'asc' }],
            skip,
            take,
        }),
        prisma.unit.count({ where }),
    ]);
    const today = manilaDay();
    res.json({
        ...toPage(units.map((unit) => ({
            ...unit,
            ...(branchScoped && unit.serviceSite?.branchId !== user.branchId
                ? { serviceSite: null, serviceSiteId: null }
                : {}),
            dueState: manilaDay(unit.nextMaintenanceAt!) < today ? 'PAST_DUE' : manilaDay(unit.nextMaintenanceAt!) === today ? 'DUE_TODAY' : 'UPCOMING',
        })), total, page, limit),
        branchAttribution: scopedBranchId ? 'BRANCH_ACTIVITY' : 'ORGANIZATION_WIDE',
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
        through,
    });
};
