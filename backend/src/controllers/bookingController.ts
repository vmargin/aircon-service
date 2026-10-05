import { Request, Response } from 'express';
import { z } from 'zod';
import { BookingPriority, BookingStatus, Prisma, UserRole } from '@prisma/client';
import prisma from '../db/prisma';
import { auditInTransaction } from '../lib/auditLog';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { requireUser } from '../middleware/auth';
import { assertBranchInScope, assertCustomerInScope, branchScopedWhere } from '../lib/tenancy';
import { assertValidTransition } from '../lib/bookingStatus';
import { parsePagination, toPage } from '../lib/pagination';
import { BOOKING_INCLUDE, serializeBooking } from '../lib/bookingView';
import { assertDispatchAvailable, assertOpen, assertTechnicianAssignable, TERMINAL_STATUSES } from '../lib/dispatch';

const sharedFields = {
    serviceType: z.string().trim().min(1).max(120),
    scheduledAt: z.string().datetime(),
    technicianId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
    unitId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    durationMinutes: z.number().int().min(30).max(480).default(120),
    priority: z.nativeEnum(BookingPriority).default(BookingPriority.NORMAL),
};
const createSchema = z.object({ ...sharedFields, customerId: z.string().uuid(), branchId: z.string().uuid() });
const checklistSchema = z.array(z.object({ id: z.string().min(1).max(80), label: z.string().trim().min(1).max(250), checked: z.boolean() })).max(30).refine((items) => new Set(items.map((item) => item.id)).size === items.length, 'Checklist item IDs must be unique.');
const updateSchema = z.object({ ...sharedFields, durationMinutes: z.number().int().min(30).max(480), priority: z.nativeEnum(BookingPriority), status: z.nativeEnum(BookingStatus), diagnosis: z.string().trim().max(4000).nullable(), checklist: checklistSchema }).partial();
const listSchema = z.object({ status: z.nativeEnum(BookingStatus).optional(), branchId: z.string().uuid().optional(), technicianId: z.string().uuid().optional(), customerId: z.string().uuid().optional(), unitId: z.string().uuid().optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), q: z.string().trim().max(100).optional(), search: z.string().trim().max(100).optional() });

async function assertUnit(tx: Prisma.TransactionClient, orgId: string, customerId: string, unitId?: string | null) {
    if (!unitId) return;
    await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${unitId} FOR SHARE`;
    const unit = await tx.unit.findFirst({ where: { id: unitId, organizationId: orgId, customerId } });
    if (!unit) throw new ValidationError('Choose a unit registered to this customer.');
}

export const getBookings = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = listSchema.parse(req.query);
    const where: Prisma.BookingWhereInput = { ...branchScopedWhere(user) };
    if (filters.status) where.status = filters.status;
    if (filters.technicianId) where.technicianId = filters.technicianId;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.unitId) where.unitId = filters.unitId;
    if (filters.branchId && user.role === UserRole.ADMIN) where.branchId = filters.branchId;
    if (filters.from || filters.to) where.scheduledAt = { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) };
    const search = filters.q || filters.search;
    if (search) where.OR = [ { serviceType: { contains: search, mode: 'insensitive' } }, { customer: { name: { contains: search, mode: 'insensitive' } } }, { customer: { phone: { contains: search } } } ];
    const [bookings, total] = await prisma.$transaction([
        prisma.booking.findMany({ where, include: BOOKING_INCLUDE, orderBy: { scheduledAt: 'asc' }, skip, take }),
        prisma.booking.count({ where }),
    ]);
    res.json(toPage(bookings.map(serializeBooking), total, page, limit));
};

export const createBooking = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = createSchema.parse(req.body);
    const booking = await prisma.$transaction(async (tx) => {
        await assertBranchInScope(user, data.branchId, tx);
        await assertCustomerInScope(user, data.customerId, tx);
        await assertUnit(tx, user.orgId, data.customerId, data.unitId);
        const scheduledAt = new Date(data.scheduledAt);
        if (data.technicianId) await assertDispatchAvailable(tx, user, data.technicianId, data.branchId, scheduledAt, data.durationMinutes);
        const created = await tx.booking.create({ data: { ...data, scheduledAt, technicianId: data.technicianId || null, unitId: data.unitId || null }, include: BOOKING_INCLUDE });
        await auditInTransaction(tx, req, 'BOOKING_CREATE', 'booking', created.id, created.branchId, `${created.serviceType} for ${created.customer.name}`);
        return created;
    });
    res.status(201).json(serializeBooking(booking));
};

export const updateBooking = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = updateSchema.parse(req.body);
    if (!Object.keys(data).length) throw new ValidationError('No booking changes were supplied.');
    const updated = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const booking = await tx.booking.findFirst({ where: { id: req.params.id, ...branchScopedWhere(user) }, include: { invoice: true } });
        if (!booking) throw new NotFoundError('Booking not found');
        if (TERMINAL_STATUSES.includes(booking.status) && Object.keys(data).length === 1 && data.status === booking.status) {
            return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, include: BOOKING_INCLUDE });
        }
        assertOpen(booking.status);
        if (data.status) assertValidTransition(booking.status, data.status);
        if (data.status === BookingStatus.COMPLETED && !booking.invoice) throw new ValidationError('Create an invoice before completing this work order.');
        const technicianId = data.technicianId === undefined ? booking.technicianId : data.technicianId || null;
        const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : booking.scheduledAt;
        const durationMinutes = data.durationMinutes ?? booking.durationMinutes;
        await assertUnit(tx, user.orgId, booking.customerId, data.unitId);
        if (technicianId && !TERMINAL_STATUSES.includes(data.status ?? booking.status)) {
            await assertDispatchAvailable(tx, user, technicianId, booking.branchId, scheduledAt, durationMinutes, booking.id);
        } else if (technicianId && data.technicianId !== undefined) {
            await assertTechnicianAssignable(tx, user, technicianId, booking.branchId);
        }
        if (data.status === BookingStatus.ON_SITE && !technicianId) throw new ValidationError('Assign a technician before starting on-site service.');
        const result = await tx.booking.update({ where: { id: booking.id }, data: { ...data, scheduledAt, technicianId, unitId: data.unitId === undefined ? undefined : data.unitId || null, checklist: data.checklist as Prisma.InputJsonValue | undefined }, include: BOOKING_INCLUDE });
        await auditInTransaction(tx, req, 'BOOKING_UPDATE', 'booking', result.id, result.branchId, data.status ? `Status ${booking.status} → ${data.status}` : `Updated ${result.customer.name} work order`);
        return result;
    });
    res.json(serializeBooking(updated));
};

export const getBookingById = async (req: Request, res: Response) => {
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id, ...branchScopedWhere(requireUser(req)) }, include: BOOKING_INCLUDE });
    if (!booking) throw new NotFoundError('Booking not found');
    res.json(serializeBooking(booking));
};

export const deleteBooking = async (req: Request, res: Response) => {
    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const booking = await tx.booking.findFirst({ where: { id: req.params.id, ...branchScopedWhere(requireUser(req)) }, include: { invoice: true, _count: { select: { parts: true } } } });
        if (!booking) throw new NotFoundError('Booking not found');
        assertOpen(booking.status);
        if (booking.invoice || booking._count.parts > 0) throw new ValidationError('A booking with billing or stock history cannot be deleted. Cancel it instead.');
        await tx.booking.delete({ where: { id: booking.id } });
        await auditInTransaction(tx, req, 'BOOKING_DELETE', 'booking', booking.id, booking.branchId);
    });
    res.json({ message: 'Booking deleted successfully' });
};
