import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { requireUser } from '../middleware/auth';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { auditInTransaction } from '../lib/auditLog';
import { assertBranchInScope, branchScopedWhere } from '../lib/tenancy';
import { assertOpen } from '../lib/dispatch';
import { costField } from '../lib/money';
import { parsePagination, toPage } from '../lib/pagination';
import { BOOKING_INCLUDE, serializeBooking } from '../lib/bookingView';

const schema = z.object({ branchId: z.string().uuid(), name: z.string().trim().min(2).max(120), sku: z.string().trim().min(2).max(80), unit: z.string().trim().min(1).max(40).default('pcs'), quantityOnHand: z.number().int().min(0).max(1_000_000).default(0), reorderLevel: z.number().int().min(0).max(100_000).default(5), unitCost: costField });
const restockSchema = z.object({ quantity: z.number().int().positive().max(1_000_000), note: z.string().trim().max(300).optional() });
const usageSchema = z.object({ inventoryItemId: z.string().uuid(), quantity: z.number().int().positive().max(100_000) });

export const getInventory = async (req: Request, res: Response) => {
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = z.object({ search: z.string().trim().max(100).optional(), branchId: z.string().uuid().optional() }).parse(req.query);
    const user = requireUser(req);
    const where: Prisma.InventoryItemWhereInput = { ...branchScopedWhere(user), ...(filters.branchId && user.role === 'ADMIN' ? { branchId: filters.branchId } : {}), ...(filters.search ? { OR: [{ name: { contains: filters.search, mode: 'insensitive' } }, { sku: { contains: filters.search, mode: 'insensitive' } }] } : {}) };
    const [items, total] = await prisma.$transaction([prisma.inventoryItem.findMany({ where, include: { branch: true, movements: { orderBy: { createdAt: 'desc' }, take: 10 } }, orderBy: { name: 'asc' }, skip, take }), prisma.inventoryItem.count({ where })]);
    res.json(toPage(items.map((item) => ({ ...item, unitCost: item.unitCost.toFixed(2), lowStock: item.quantityOnHand <= item.reorderLevel })), total, page, limit));
};

export const createInventoryItem = async (req: Request, res: Response) => {
    const data = schema.parse(req.body);
    const item = await prisma.$transaction(async (tx) => {
        await assertBranchInScope(requireUser(req), data.branchId, tx);
        const result = await tx.inventoryItem.create({ data, include: { branch: true } });
        if (data.quantityOnHand > 0) await tx.stockMovement.create({ data: { inventoryItemId: result.id, quantity: data.quantityOnHand, reason: 'Opening stock' } });
        await auditInTransaction(tx, req, 'INVENTORY_CREATE', 'inventory', result.id, result.branchId, `Registered ${result.name} (${result.quantityOnHand} ${result.unit})`);
        return result;
    });
    res.status(201).json({ ...item, unitCost: item.unitCost.toFixed(2) });
};

export const restockInventory = async (req: Request, res: Response) => {
    const data = restockSchema.parse(req.body);
    const item = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "InventoryItem" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const existing = await tx.inventoryItem.findFirst({ where: { id: req.params.id, ...branchScopedWhere(requireUser(req)) } });
        if (!existing) throw new NotFoundError('Inventory item not found');
        if (existing.quantityOnHand + data.quantity > 1_000_000) throw new ValidationError('Stock exceeds the supported maximum.');
        const updated = await tx.inventoryItem.update({ where: { id: existing.id }, data: { quantityOnHand: { increment: data.quantity } }, include: { branch: true } });
        await tx.stockMovement.create({ data: { inventoryItemId: existing.id, quantity: data.quantity, reason: data.note || 'Restock' } });
        await auditInTransaction(tx, req, 'INVENTORY_RESTOCK', 'inventory', existing.id, existing.branchId, `Added ${data.quantity} ${existing.unit} of ${existing.name}`);
        return updated;
    });
    res.json({ ...item, unitCost: item.unitCost.toFixed(2) });
};

export const useBookingPart = async (req: Request, res: Response) => {
    const data = usageSchema.parse(req.body);
    const booking = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const existing = await tx.booking.findFirst({ where: { id: req.params.id, ...branchScopedWhere(requireUser(req)) }, include: { invoice: true } });
        if (!existing) throw new NotFoundError('Booking not found');
        assertOpen(existing.status);
        if (existing.invoice) throw new ValidationError('Parts are locked after invoicing. Finalize the parts used before issuing the invoice.');
        await tx.$queryRaw`SELECT "id" FROM "InventoryItem" WHERE "id" = ${data.inventoryItemId} FOR UPDATE`;
        const item = await tx.inventoryItem.findFirst({ where: { id: data.inventoryItemId, branchId: existing.branchId, ...branchScopedWhere(requireUser(req)) } });
        if (!item) throw new NotFoundError('Choose a part stocked at this booking’s branch.');
        if (item.quantityOnHand < data.quantity) throw new ConflictError(`Only ${item.quantityOnHand} ${item.unit} remain in stock.`);
        await tx.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: { decrement: data.quantity } } });
        await tx.partUsage.create({ data: { ...data, bookingId: existing.id, unitPrice: item.unitCost } });
        await tx.stockMovement.create({ data: { inventoryItemId: item.id, quantity: -data.quantity, reason: 'Used on work order', bookingId: existing.id } });
        await auditInTransaction(tx, req, 'PART_USE', 'booking', existing.id, existing.branchId, `Used ${data.quantity} ${item.unit} of ${item.name}`);
        return tx.booking.findUniqueOrThrow({ where: { id: existing.id }, include: BOOKING_INCLUDE });
    });
    res.status(201).json(serializeBooking(booking));
};
