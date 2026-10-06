import { Request, Response } from 'express';
import { BookingStatus, Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { requireUser } from '../middleware/auth';
import { branchScopedUnitWhere, branchScopedWhere, isBranchScoped } from '../lib/tenancy';
import { BOOKING_INCLUDE, serializeBooking } from '../lib/bookingView';
import { serializeInvoice } from '../lib/money';
import { invoiceScopedWhere } from './invoiceController';
import { parsePagination, toPage } from '../lib/pagination';
import { attentionBookingWhere } from '../lib/bookingAttention';

export function manilaDay(date = new Date()) {
    const day = new Date(date.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 10);
    const start = new Date(`${day}T00:00:00+08:00`);
    return { day, start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
}

export const getActivity = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const where: Prisma.AuditLogWhereInput = { user: { organizationId: user.orgId }, ...(isBranchScoped(user) ? { branchId: user.branchId } : {}) };
    const [activity, total] = await prisma.$transaction([prisma.auditLog.findMany({ where, include: { user: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, skip, take }), prisma.auditLog.count({ where })]);
    res.json(toPage(activity, total, page, limit));
};

export const getOverview = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const scope = branchScopedWhere(user);
    const invoiceScope = invoiceScopedWhere(user);
    const now = new Date();
    const { start, end } = manilaDay(now);
    const dayWhere = { ...scope, scheduledAt: { gte: start, lt: end } };
    const manila = new Date(now.getTime() + 8 * 60 * 60_000);
    const monthAnchor = new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), 1));
    const months = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() - 5 + i, 1));
        return { key: date.toISOString().slice(0, 7), month: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), date: new Date(date.getTime() - 8 * 60 * 60_000) };
    });
    const branchId = isBranchScoped(user) ? user.branchId : null;
    // Counts and money are database aggregates over the entire authorized scope,
    // independent of pagination used by detail screens.
    const [allGroups, todayGroups, attentionJobs, todayJobs, technicians, ledgerTotals, receipts, legacyPaid, legacyUnpaid, reviewCount, activity, inventory, dueUnits, recentInvoices, monthJobs, monthReceipts] = await Promise.all([
        prisma.booking.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
        prisma.booking.groupBy({ by: ['status'], where: dayWhere, _count: { _all: true } }),
        prisma.booking.count({ where: { ...scope, ...attentionBookingWhere(now) } }),
        prisma.booking.findMany({ where: dayWhere, include: BOOKING_INCLUDE, orderBy: { scheduledAt: 'asc' }, take: 200 }),
        prisma.technician.findMany({ where: { ...scope, isActive: true }, include: { branch: true, _count: { select: { bookings: { where: { scheduledAt: { gte: start, lt: end }, status: { not: BookingStatus.CANCELLED } } } } } }, orderBy: { name: 'asc' }, take: 200 }),
        prisma.invoice.aggregate({ where: { ...invoiceScope, ledgerEnabled: true }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { invoice: invoiceScope }, _sum: { amount: true } }),
        prisma.invoice.aggregate({ where: { ...invoiceScope, ledgerEnabled: false, paymentStatus: 'PAID' }, _sum: { amount: true } }),
        prisma.invoice.aggregate({ where: { ...invoiceScope, ledgerEnabled: false, paymentStatus: 'UNPAID' }, _sum: { amount: true } }),
        prisma.invoice.count({ where: { ...invoiceScope, ledgerEnabled: false, paymentStatus: 'PARTIAL' } }),
        prisma.auditLog.findMany({ where: { user: { organizationId: user.orgId }, ...(branchId ? { branchId } : {}) }, include: { user: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, take: 8 }),
        prisma.inventoryItem.findMany({ where: { ...scope, quantityOnHand: { lte: prisma.inventoryItem.fields.reorderLevel } }, include: { branch: true }, orderBy: { quantityOnHand: 'asc' }, take: 8 }),
        prisma.unit.findMany({
            where: {
                organizationId: user.orgId,
                nextMaintenanceAt: { lte: new Date(end.getTime() + 7 * 24 * 60 * 60_000) },
                ...(isBranchScoped(user) ? { AND: [branchScopedUnitWhere(user)] } : {}),
            },
            include: { customer: true }, orderBy: { nextMaintenanceAt: 'asc' }, take: 8,
        }),
        prisma.invoice.findMany({ where: invoiceScope, include: { payments: true, booking: { include: { customer: true, branch: true } } }, orderBy: { issuedAt: 'desc' }, take: 6 }),
        prisma.$queryRaw<{ key: string; completed: bigint; scheduled: bigint; inProgress: bigint }[]>`
            SELECT to_char(b."scheduledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS key,
                count(*) FILTER (WHERE b."status" = 'COMPLETED') AS completed,
                count(*) FILTER (WHERE b."status" IN ('PENDING','CONFIRMED')) AS scheduled,
                count(*) FILTER (WHERE b."status" = 'ON_SITE') AS "inProgress"
            FROM "Booking" b JOIN "Branch" br ON br.id = b."branchId"
            WHERE br."organizationId" = ${user.orgId} AND (${branchId}::text IS NULL OR b."branchId" = ${branchId})
                AND b."scheduledAt" >= ${months[0].date}
            GROUP BY key`,
        prisma.$queryRaw<{ key: string; collected: Prisma.Decimal }[]>`
            SELECT to_char(r.received AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS key, sum(r.amount) AS collected
            FROM (
                SELECT p.amount, p."createdAt" AS received, i."bookingId" FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId"
                UNION ALL SELECT i.amount, i."paidAt" AS received, i."bookingId" FROM "Invoice" i WHERE i."ledgerEnabled" = false AND i."paymentStatus" = 'PAID' AND i."paidAt" IS NOT NULL
            ) r JOIN "Booking" b ON b.id = r."bookingId" JOIN "Branch" br ON br.id = b."branchId"
            WHERE br."organizationId" = ${user.orgId} AND (${branchId}::text IS NULL OR b."branchId" = ${branchId}) AND r.received >= ${months[0].date}
            GROUP BY key`,
    ]);
    const totalJobs = allGroups.reduce((sum, group) => sum + group._count._all, 0);
    const allCompleted = allGroups.find((group) => group.status === BookingStatus.COMPLETED)?._count._all ?? 0;
    const cancelled = allGroups.find((group) => group.status === BookingStatus.CANCELLED)?._count._all ?? 0;
    const todayCount = (status: BookingStatus) => todayGroups.find((group) => group.status === status)?._count._all ?? 0;
    const collected = (receipts._sum.amount ?? new Prisma.Decimal(0)).add(legacyPaid._sum.amount ?? 0);
    const outstanding = (ledgerTotals._sum.amount ?? new Prisma.Decimal(0)).sub(receipts._sum.amount ?? 0).add(legacyUnpaid._sum.amount ?? 0);
    res.json({
        summary: { scheduledJobs: todayGroups.reduce((sum, group) => sum + (group.status === BookingStatus.CANCELLED ? 0 : group._count._all), 0), completedJobs: todayCount(BookingStatus.COMPLETED), inProgressJobs: todayCount(BookingStatus.ON_SITE), attentionJobs, collected: collected.toFixed(2), outstanding: outstanding.toFixed(2), totalJobs, completionRate: totalJobs - cancelled > 0 ? Math.round(allCompleted / (totalJobs - cancelled) * 100) : 0, needsReviewInvoices: reviewCount },
        todayJobs: todayJobs.map(serializeBooking), technicians: technicians.map((technician) => ({ ...technician, todayJobs: technician._count.bookings })),
        monthlyService: months.map((month) => { const job = monthJobs.find((row) => row.key === month.key); return { month: month.month, completed: Number(job?.completed ?? 0), scheduled: Number(job?.scheduled ?? 0), inProgress: Number(job?.inProgress ?? 0), collected: monthReceipts.find((row) => row.key === month.key)?.collected.toNumber() ?? 0 }; }),
        activity, lowStock: inventory.map((item) => ({ ...item, unitCost: item.unitCost.toFixed(2) })), dueUnits,
        recentInvoices: recentInvoices.map(serializeInvoice),
    });
};
