import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

const publicBookingSchema = z.object({
    customerName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(8).max(20),
    address: z.string().trim().max(300).optional(),
    serviceType: z.string().trim().min(1).max(120),
    scheduledAt: z.string().datetime(),
    branchId: z.string().uuid(),
});

const publicBranchesSchema = z.object({
    // Optional so a single-tenant deployment keeps working, but callers should
    // pass it: without it we would enumerate every organization on the platform.
    organizationId: z.string().uuid().optional(),
});

export const getPublicBranches = async (req: Request, res: Response) => {
    const { organizationId } = publicBranchesSchema.parse(req.query);

    const branches = await prisma.branch.findMany({
        where: organizationId ? { organizationId } : undefined,
        orderBy: { name: 'asc' },
        // Deliberately narrow: this endpoint is unauthenticated, so it exposes
        // only what the booking form needs to render.
        select: {
            id: true,
            name: true,
            location: true,
            organization: { select: { name: true } },
        },
    });

    res.json(
        branches.map((b) => ({
            id: b.id,
            name: b.name,
            location: b.location,
            organizationName: b.organization.name,
        }))
    );
};

export const createPublicBooking = async (req: Request, res: Response) => {
    const validation = publicBookingSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    const { customerName, phone, address, serviceType, scheduledAt, branchId } = validation.data;

    const scheduled = new Date(scheduledAt);
    if (scheduled.getTime() < Date.now()) {
        throw new ValidationError('Please choose a date and time in the future.');
    }

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundError('Branch not found');

    // Customer + booking must be created together: previously a failure on the
    // booking left an orphaned customer behind. The upsert also closes the race
    // where two concurrent submissions from the same phone number both passed
    // the "does this customer exist?" check.
    const booking = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.upsert({
            where: {
                organizationId_phone: { organizationId: branch.organizationId, phone },
            },
            update: { address: address || undefined },
            create: {
                name: customerName,
                phone,
                address,
                organizationId: branch.organizationId,
            },
        });

        return tx.booking.create({
            data: {
                serviceType,
                scheduledAt: scheduled,
                customerId: customer.id,
                branchId: branch.id,
            },
        });
    });

    res.status(201).json({ success: true, bookingId: booking.id });
};
