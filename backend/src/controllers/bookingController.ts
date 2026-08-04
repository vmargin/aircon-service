import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { BookingStatus, Prisma, UserRole } from '@prisma/client';
import { logAudit } from '../lib/auditLog';
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { requireUser } from '../middleware/auth';
import {
    assertBranchInScope,
    assertCustomerInScope,
    assertTechnicianInScope,
    branchScopedWhere,
} from '../lib/tenancy';
import { assertValidTransition } from '../lib/bookingStatus';
import { parsePagination, toPage } from '../lib/pagination';

const BOOKING_INCLUDE = {
    customer: true,
    branch: true,
    technician: true,
    invoice: true,
} satisfies Prisma.BookingInclude;

const createBookingSchema = z.object({
    customerId: z.string().uuid(),
    serviceType: z.string().min(1).max(120),
    scheduledAt: z.string().datetime(),
    branchId: z.string().uuid(),
    technicianId: z.string().uuid().optional(),
    notes: z.string().max(2000).optional(),
});

const updateBookingSchema = z.object({
    status: z.nativeEnum(BookingStatus).optional(),
    scheduledAt: z.string().datetime().optional(),
    // '' and null both mean "unassign".
    technicianId: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
    notes: z.string().max(2000).optional(),
});

const listBookingsSchema = z.object({
    status: z.nativeEnum(BookingStatus).optional(),
    branchId: z.string().uuid().optional(),
    technicianId: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    q: z.string().trim().min(1).max(100).optional(),
});

export const getBookings = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = listBookingsSchema.parse(req.query);

    const where: Prisma.BookingWhereInput = { ...branchScopedWhere(user) };

    if (filters.status) where.status = filters.status;
    if (filters.technicianId) where.technicianId = filters.technicianId;

    // An admin may narrow to a branch; a branch leader is already pinned to one.
    if (filters.branchId && user.role === UserRole.ADMIN) {
        where.branchId = filters.branchId;
    }

    if (filters.from || filters.to) {
        where.scheduledAt = {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
        };
    }

    if (filters.q) {
        where.OR = [
            { serviceType: { contains: filters.q, mode: 'insensitive' } },
            { customer: { name: { contains: filters.q, mode: 'insensitive' } } },
            { customer: { phone: { contains: filters.q } } },
        ];
    }

    const [bookings, total] = await prisma.$transaction([
        prisma.booking.findMany({
            where,
            include: BOOKING_INCLUDE,
            orderBy: { scheduledAt: 'asc' },
            skip,
            take,
        }),
        prisma.booking.count({ where }),
    ]);

    res.json(toPage(bookings, total, page, limit));
};

export const createBooking = async (req: Request, res: Response) => {
    const user = requireUser(req);

    const validation = createBookingSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    const { customerId, branchId, technicianId, serviceType, scheduledAt, notes } =
        validation.data;

    // Resolve every foreign key inside the caller's tenant before writing.
    // Without this an admin could attach a booking to another org's branch.
    await assertBranchInScope(user, branchId);
    await assertCustomerInScope(user, customerId);

    if (technicianId) {
        const technician = await assertTechnicianInScope(user, technicianId);
        if (technician.branchId !== branchId) {
            throw new ForbiddenError('Technician does not belong to this branch');
        }
    }

    const booking = await prisma.booking.create({
        data: {
            customerId,
            branchId,
            technicianId: technicianId || null,
            serviceType,
            notes,
            scheduledAt: new Date(scheduledAt),
        },
        include: BOOKING_INCLUDE,
    });

    await logAudit(req, 'BOOKING_CREATE', 'booking', booking.id, booking.branchId);
    res.status(201).json(booking);
};

export const updateBooking = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const validation = updateBookingSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    const { status, scheduledAt, technicianId, notes } = validation.data;

    const booking = await prisma.booking.findFirst({
        where: { id, ...branchScopedWhere(user) },
        include: { invoice: true },
    });

    if (!booking) throw new NotFoundError('Booking not found');

    if (status) {
        assertValidTransition(booking.status, status);

        // Billing guard: a job cannot be closed out before it has been invoiced.
        if (status === BookingStatus.COMPLETED && !booking.invoice) {
            throw new ValidationError('Billing Guard: an invoice is required before completion.');
        }
    }

    // technicianId is optional; '' / null explicitly unassign.
    let nextTechnicianId: string | null | undefined;
    if (technicianId !== undefined) {
        if (!technicianId) {
            nextTechnicianId = null;
        } else {
            const technician = await assertTechnicianInScope(user, technicianId);
            if (technician.branchId !== booking.branchId) {
                throw new ForbiddenError('Technician does not belong to this booking\'s branch');
            }
            nextTechnicianId = technician.id;
        }
    }

    const updated = await prisma.booking.update({
        where: { id },
        data: {
            status,
            notes,
            technicianId: nextTechnicianId,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        },
        include: BOOKING_INCLUDE,
    });

    await logAudit(
        req,
        'BOOKING_UPDATE',
        'booking',
        updated.id,
        updated.branchId,
        status ? `status: ${booking.status} -> ${status}` : undefined
    );
    res.json(updated);
};

export const getBookingById = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const booking = await prisma.booking.findFirst({
        where: { id, ...branchScopedWhere(user) },
        include: BOOKING_INCLUDE,
    });

    if (!booking) throw new NotFoundError('Booking not found');
    res.json(booking);
};

export const deleteBooking = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const booking = await prisma.booking.findFirst({
        where: { id, ...branchScopedWhere(user) },
        include: { invoice: true },
    });

    if (!booking) throw new NotFoundError('Booking not found');

    // Deleting a booking with an invoice would orphan financial history.
    if (booking.invoice) {
        throw new ValidationError(
            'Cannot delete a booking that has been invoiced. Cancel it instead.'
        );
    }

    await prisma.booking.delete({ where: { id } });
    await logAudit(req, 'BOOKING_DELETE', 'booking', id, booking.branchId);
    res.json({ message: 'Booking deleted successfully' });
};
