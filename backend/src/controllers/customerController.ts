import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';
import { requireUser } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import { logAudit } from '../lib/auditLog';
import { parsePagination, toPage } from '../lib/pagination';

const customerSchema = z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(8).max(20),
    address: z.string().trim().max(300).optional(),
});

const listCustomersSchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
});

export const getCustomers = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const { q } = listCustomersSchema.parse(req.query);

    const where: Prisma.CustomerWhereInput = { organizationId: user.orgId };
    if (q) {
        where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
        ];
    }

    const [customers, total] = await prisma.$transaction([
        prisma.customer.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
        prisma.customer.count({ where }),
    ]);

    res.json(toPage(customers, total, page, limit));
};

export const createCustomer = async (req: Request, res: Response) => {
    const user = requireUser(req);

    const validation = customerSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    // (organizationId, phone) is unique — a duplicate surfaces as a 409 via the
    // Prisma error mapping in the error handler.
    const customer = await prisma.customer.create({
        data: { ...validation.data, organizationId: user.orgId },
    });

    await logAudit(req, 'CUSTOMER_CREATE', 'customer', customer.id, user.branchId ?? null);
    res.status(201).json(customer);
};
