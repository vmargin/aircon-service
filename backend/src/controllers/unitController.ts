import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../db/prisma';
import { requireUser } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { auditInTransaction } from '../lib/auditLog';
import { assertCustomerInScope } from '../lib/tenancy';
import { parsePagination, toPage } from '../lib/pagination';

const schema = z.object({
    customerId: z.string().uuid(), name: z.string().trim().min(2).max(120), brand: z.string().trim().min(1).max(80),
    model: z.string().trim().max(100).nullable().optional(), serialNumber: z.string().trim().max(100).nullable().optional(),
    type: z.string().trim().min(1).max(80).optional(), capacity: z.string().trim().max(80).nullable().optional(),
    location: z.string().trim().max(300).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(),
    installedAt: z.string().datetime().nullable().optional(), nextMaintenanceAt: z.string().datetime().nullable().optional(),
});
const listSchema = z.object({ customerId: z.string().uuid().optional(), search: z.string().trim().max(100).optional() });
function dates<T extends { installedAt?: string | null; nextMaintenanceAt?: string | null }>(data: T) {
    return { ...data, installedAt: data.installedAt ? new Date(data.installedAt) : data.installedAt, nextMaintenanceAt: data.nextMaintenanceAt ? new Date(data.nextMaintenanceAt) : data.nextMaintenanceAt };
}

export const getUnits = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const { customerId, search } = listSchema.parse(req.query);
    const where: Prisma.UnitWhereInput = { organizationId: user.orgId, ...(customerId ? { customerId } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { brand: { contains: search, mode: 'insensitive' } }, { customer: { name: { contains: search, mode: 'insensitive' } } }] } : {}) };
    const [units, total] = await prisma.$transaction([prisma.unit.findMany({ where, include: { customer: true, _count: { select: { bookings: true } } }, orderBy: { name: 'asc' }, skip, take }), prisma.unit.count({ where })]);
    res.json(toPage(units, total, page, limit));
};

export const createUnit = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = schema.parse(req.body);
    const unit = await prisma.$transaction(async (tx) => {
        await assertCustomerInScope(user, data.customerId, tx);
        const result = await tx.unit.create({ data: { ...dates(data), organizationId: user.orgId }, include: { customer: true } });
        await auditInTransaction(tx, req, 'UNIT_CREATE', 'unit', result.id, user.branchId, `${result.name} registered to ${result.customer.name}`);
        return result;
    });
    res.status(201).json(unit);
};

export const updateUnit = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const data = schema.partial().parse(req.body);
    const unit = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const existing = await tx.unit.findFirst({ where: { id: req.params.id, organizationId: user.orgId }, include: { _count: { select: { bookings: true } } } });
        if (!existing) throw new NotFoundError('Unit not found');
        if (data.customerId && data.customerId !== existing.customerId) {
            if (existing._count.bookings > 0) throw new ValidationError('A unit with service history cannot be transferred to another customer.');
            await assertCustomerInScope(user, data.customerId, tx);
        }
        const result = await tx.unit.update({ where: { id: existing.id }, data: dates(data), include: { customer: true } });
        await auditInTransaction(tx, req, 'UNIT_UPDATE', 'unit', result.id, user.branchId, `Updated ${result.name}`);
        return result;
    });
    res.json(unit);
};
