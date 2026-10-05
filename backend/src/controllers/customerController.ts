import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../db/prisma';
import { requireUser } from '../middleware/auth';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { parsePagination, toPage } from '../lib/pagination';
import { auditInTransaction } from '../lib/auditLog';

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
    email: z.union([z.string().trim().email().max(150), z.literal(''), z.null()]).optional(),
    type: z.string().trim().min(1).max(60).optional(),
    contactPerson: z.string().trim().max(120).nullable().optional(),
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
            include: { _count: { select: { bookings: true, units: true } } },
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

    const { name, phone, address, email, type, contactPerson } = validation.data;

    try {
        const customer = await prisma.$transaction(async (tx) => {
          const result = await tx.customer.create({
            data: {
                name,
                phone,
                address: address || null,
                organizationId: user.orgId,
                email: email || null, type, contactPerson,
            },
          });
          await auditInTransaction(tx, req, 'CUSTOMER_CREATE', 'customer', result.id, user.branchId, `Created ${result.name}`);
          return result;
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

    const { name, phone, address, email, type, contactPerson } = validation.data;

    try {
        const customer = await prisma.$transaction(async (tx) => {
          const result = await tx.customer.update({
            where: { id: existing.id },
            data: {
                ...(name !== undefined && { name }),
                ...(phone !== undefined && { phone }),
                ...(address !== undefined && { address: address || null }),
                ...(email !== undefined && { email: email || null }),
                ...(type !== undefined && { type }),
                ...(contactPerson !== undefined && { contactPerson }),
            },
          });
          await auditInTransaction(tx, req, 'CUSTOMER_UPDATE', 'customer', result.id, user.branchId, `Updated ${result.name}`);
          return result;
        });
        res.json(customer);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new ConflictError(`A customer with phone ${phone} already exists.`);
        }
        throw err;
    }
};
