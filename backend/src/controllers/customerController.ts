import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';

const customerSchema = z.object({
    name: z.string().min(1),
    phone: z.string().min(8),
    address: z.string().optional(),
});

export const getCustomers = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const customers = await prisma.customer.findMany({
            where: { organizationId: user.orgId },
            orderBy: { name: 'asc' }
        });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch customers" });
    }
};

export const createCustomer = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const validation = customerSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: validation.error.issues[0].message });

    try {
        const customer = await prisma.customer.create({
            data: { ...validation.data, organizationId: user.orgId }
        });
        res.status(201).json(customer);
    } catch (error) {
        res.status(500).json({ error: "Failed to create customer" });
    }
};
