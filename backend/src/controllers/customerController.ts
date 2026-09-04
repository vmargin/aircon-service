import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../db/prisma';
import { requireUser } from '../middleware/auth';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { parsePagination, toPage } from '../lib/pagination';

/**
 * Customers belong to the organization, not to a branch, so both ADMIN and
 * BRANCH_LEADER see the same list. Scoping is by organizationId only.
 */

const phoneField = z
    .string()
    .trim()
    .min(7, 'Phone number is too short')
    .max(20, 'Phone number is too long');

const createSchema = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    phone: phoneField,
    address: z.string().trim().max(300).optional().or(z.literal('')),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
    search: z.string().trim().max(100).optional(),
});

export const getCustomers = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const { search } = listQuerySchema.parse(req.query);

    const where: Prisma.CustomerWhereInput = {
        organizationId: user.orgId,
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' as const } },
                      { phone: { contains: search } },
                  ],
              }
            : {}),
    };

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            skip,
            take,
            orderBy: { name: 'asc' },
            // _count avoids pulling every booking row just to show a total.
            include: { _count: { select: { bookings: true } } },
        }),
        prisma.customer.count({ where }),
    ]);

    res.json(toPage(customers, total, page, limit));
};

export const createCustomer = async (req: Request, res: Response) => {
    const user = requireUser(req);

    const validation = createSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    const { name, phone, address } = validation.data;

    try {
        const customer = await prisma.customer.create({
            data: {
                name,
                phone,
                address: address || null,
                organizationId: user.orgId,
            },
        });
        res.status(201).json(customer);
    } catch (err) {
        // (organizationId, phone) is unique — surface a usable message rather
        // than a raw Prisma error.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new ConflictError(`A customer with phone ${phone} already exists.`);
        }
        throw err;
    }
};

export const updateCustomer = async (req: Request, res: Response) => {
    const user = requireUser(req);

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    // Confirm the record is in the caller's org before touching it, so an id
    // from another tenant returns 404 rather than being updated.
    const existing = await prisma.customer.findFirst({
        where: { id: req.params.id, organizationId: user.orgId },
    });
    if (!existing) throw new NotFoundError('Customer not found');

    const { name, phone, address } = validation.data;

    try {
        const customer = await prisma.customer.update({
            where: { id: existing.id },
            data: {
                ...(name !== undefined && { name }),
                ...(phone !== undefined && { phone }),
                ...(address !== undefined && { address: address || null }),
            },
        });
        res.json(customer);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new ConflictError(`A customer with phone ${phone} already exists.`);
        }
        throw err;
    }
};
