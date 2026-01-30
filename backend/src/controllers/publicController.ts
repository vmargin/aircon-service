import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';

const publicBookingSchema = z.object({
    customerName: z.string().min(1),
    phone: z.string().min(6),
    address: z.string().optional(),
    serviceType: z.string().min(1),
    scheduledAt: z.string().datetime(),
    branchId: z.string().uuid(),
});

export const getPublicBranches = async (_req: Request, res: Response) => {
    try {
        const branches = await prisma.branch.findMany({
            include: {
                organization: true,
            },
            orderBy: { name: 'asc' },
        });

        const payload = branches.map((b) => ({
            id: b.id,
            name: b.name,
            location: b.location,
            organizationName: b.organization.name,
        }));

        res.json(payload);
    } catch (error) {
        console.error('Get public branches error:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
};

export const createPublicBooking = async (req: Request, res: Response) => {
    const validation = publicBookingSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const { customerName, phone, address, serviceType, scheduledAt, branchId } = validation.data;

    try {
        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            include: { organization: true },
        });

        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        // Find or create customer within this organization by phone
        let customer = await prisma.customer.findFirst({
            where: {
                phone,
                organizationId: branch.organizationId,
            },
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    name: customerName,
                    phone,
                    address,
                    organizationId: branch.organizationId,
                },
            });
        }

        const booking = await prisma.booking.create({
            data: {
                serviceType,
                scheduledAt: new Date(scheduledAt),
                customerId: customer.id,
                branchId: branch.id,
            },
        });

        res.status(201).json({ success: true, bookingId: booking.id });
    } catch (error) {
        console.error('Create public booking error:', error);
        res.status(500).json({ error: 'Failed to submit booking' });
    }
};

