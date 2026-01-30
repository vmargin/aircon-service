import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { BookingStatus, UserRole } from '@prisma/client';

const createBookingSchema = z.object({
    customerId: z.string().uuid(),
    serviceType: z.string().min(1),
    scheduledAt: z.string().datetime(),
    branchId: z.string().uuid(),
    technicianId: z.string().uuid().optional(),
});

const updateBookingSchema = z.object({
    status: z.nativeEnum(BookingStatus).optional(),
    scheduledAt: z.string().datetime().optional(),
    technicianId: z.string().uuid().optional(),
});

export const getBookings = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const bookings = await prisma.booking.findMany({
            where: { branch: { organizationId: user.orgId } },
            include: { customer: true, branch: true, technician: true, invoice: true },
            orderBy: { scheduledAt: 'asc' },
        });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
};

export const createBooking = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const validation = createBookingSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0].message });
    }

    try {
        const booking = await prisma.booking.create({
            data: {
                ...validation.data,
                scheduledAt: new Date(validation.data.scheduledAt),
            },
            include: { branch: true }
        });
        res.status(201).json(booking);
    } catch (error) {
        console.error("Create booking error:", error);
        res.status(500).json({ error: "Failed to create booking" });
    }
};

export const updateBooking = async (req: Request, res: Response) => {
    const { user } = req;
    const { id } = req.params as { id: string };

    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const validation = updateBookingSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0].message });
    }

    try {
        const booking = await prisma.booking.findFirst({
            where: {
                id,
                branch: { organizationId: user.orgId }
            },
            include: { invoice: true, branch: true }
        });

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        // BI Logic: Prevent Branch Leader from updating other branch jobs
        if (user.role === UserRole.BRANCH_LEADER && booking.branchId !== user.branchId) {
            return res.status(403).json({ error: "Unauthorized branch access" });
        }

        // Billing Guard: Prevent COMPLETED status without an Invoice
        if (validation.data.status === BookingStatus.COMPLETED && !booking.invoice) {
            return res.status(400).json({ error: "Billing Guard: Invoice required for completion." });
        }

        const updated = await prisma.booking.update({
            where: { id },
            data: {
                status: validation.data.status,
                technicianId: validation.data.technicianId,
                scheduledAt: validation.data.scheduledAt ? new Date(validation.data.scheduledAt) : undefined,
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: "Failed to update booking" });
    }
};
