import { Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
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
const idempotencyKeySchema = z.string().uuid();
const restockSchema = z.object({ quantity: z.number().int().positive().max(1_000_000), note: z.string().trim().max(300).optional(), idempotencyKey: idempotencyKeySchema });
const adjustmentSchema = z.object({ delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, 'Adjustment must be nonzero.'), reason: z.string().trim().min(1).max(300), idempotencyKey: idempotencyKeySchema });
const usageSchema = z.object({ inventoryItemId: z.string().uuid(), quantity: z.number().int().positive().max(100_000), idempotencyKey: idempotencyKeySchema });
const resourceIdSchema = z.string().uuid();

function movementPayloadHash(userId: string, orgId: string, action: string, payload: Record<string, string | number | null>) {
    return createHash('sha256').update(JSON.stringify({ action, actorId: userId, organizationId: orgId, ...payload })).digest('hex');
}

async function lockIdempotencyKey(tx: Prisma.TransactionClient, idempotencyKey: string) {
    await tx.$queryRaw`WITH idempotency_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))) SELECT 1::int FROM idempotency_lock`;
}

async function isIdempotentReplay(tx: Prisma.TransactionClient, idempotencyKey: string, payloadHash: string) {
    const movement = await tx.stockMovement.findUnique({ where: { idempotencyKey } });
    if (!movement) return false;
    if (movement.idempotencyPayloadHash !== payloadHash) {
        throw new ConflictError('This stock movement key has already been used with different details.');
    }
    return true;
}

function serializeInventoryItem<T extends { unitCost: Prisma.Decimal }>(item: T) {
    return { ...item, unitCost: item.unitCost.toFixed(2) };
}

export const getInventory = async (req: Request, res: Response) => {
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = z.object({ search: z.string().trim().max(100).optional(), branchId: z.string().uuid().optional() }).parse(req.query);
    const user = requireUser(req);
    const where: Prisma.InventoryItemWhereInput = { ...branchScopedWhere(user), ...(filters.branchId && user.role === 'ADMIN' ? { branchId: filters.branchId } : {}), ...(filters.search ? { OR: [{ name: { contains: filters.search, mode: 'insensitive' } }, { sku: { contains: filters.search, mode: 'insensitive' } }] } : {}) };
    const [items, total] = await prisma.$transaction([prisma.inventoryItem.findMany({ where, include: { branch: true, movements: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, quantity: true, reason: true, createdAt: true } } }, orderBy: { name: 'asc' }, skip, take }), prisma.inventoryItem.count({ where })]);
    res.json(toPage(items.map((item) => ({ ...serializeInventoryItem(item), lowStock: item.quantityOnHand <= item.reorderLevel })), total, page, limit));
};

export const createInventoryItem = async (req: Request, res: Response) => {
    const data = schema.parse(req.body);
    const { branchId, ...itemData } = data;
    const item = await prisma.$transaction(async (tx) => {
        await assertBranchInScope(requireUser(req), branchId, tx);
        const result = await tx.inventoryItem.create({ data: { ...itemData, unitCost: data.unitCost!, branch: { connect: { id: branchId } } }, include: { branch: true } });
        if (data.quantityOnHand > 0) await tx.stockMovement.create({ data: { inventoryItemId: result.id, quantity: data.quantityOnHand, reason: 'Opening stock' } });
        await auditInTransaction(tx, req, 'INVENTORY_CREATE', 'inventory', result.id, result.branchId, `Registered ${result.name} (${result.quantityOnHand} ${result.unit})`);
        return result;
    });
    res.status(201).json({ ...item, unitCost: item.unitCost.toFixed(2) });
};

export const restockInventory = async (req: Request, res: Response) => {
    const data = restockSchema.parse(req.body);
    const user = requireUser(req);
    const inventoryItemId = resourceIdSchema.parse(req.params.id);
    const payloadHash = movementPayloadHash(user.userId, user.orgId, 'RESTOCK', { inventoryItemId, quantity: data.quantity, note: data.note || null });
    const item = await prisma.$transaction(async (tx) => {
        await lockIdempotencyKey(tx, data.idempotencyKey);
        await tx.$queryRaw`SELECT "id" FROM "InventoryItem" WHERE "id" = ${inventoryItemId} FOR UPDATE`;
        const existing = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, ...branchScopedWhere(user) }, include: { branch: true } });
        if (!existing) throw new NotFoundError('Inventory item not found');
        if (await isIdempotentReplay(tx, data.idempotencyKey, payloadHash)) return existing;
        if (existing.quantityOnHand + data.quantity > 1_000_000) throw new ValidationError('Stock exceeds the supported maximum.');
        const updated = await tx.inventoryItem.update({ where: { id: existing.id }, data: { quantityOnHand: { increment: data.quantity } }, include: { branch: true } });
        await tx.stockMovement.create({ data: { inventoryItemId: existing.id, quantity: data.quantity, reason: data.note || 'Restock', idempotencyKey: data.idempotencyKey, idempotencyPayloadHash: payloadHash } });
        await auditInTransaction(tx, req, 'INVENTORY_RESTOCK', 'inventory', existing.id, existing.branchId, `Added ${data.quantity} ${existing.unit} of ${existing.name}`);
        return updated;
    });
    res.json(serializeInventoryItem(item));
};

export const adjustInventory = async (req: Request, res: Response) => {
    const data = adjustmentSchema.parse(req.body);
    const user = requireUser(req);
    const inventoryItemId = resourceIdSchema.parse(req.params.id);
    const payloadHash = movementPayloadHash(user.userId, user.orgId, 'ADJUSTMENT', { inventoryItemId, delta: data.delta, reason: data.reason });
    const result = await prisma.$transaction(async (tx) => {
        await lockIdempotencyKey(tx, data.idempotencyKey);
        await tx.$queryRaw`SELECT "id" FROM "InventoryItem" WHERE "id" = ${inventoryItemId} FOR UPDATE`;
        const existing = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, ...branchScopedWhere(user) }, include: { branch: true } });
        if (!existing) throw new NotFoundError('Inventory item not found');
        if (await isIdempotentReplay(tx, data.idempotencyKey, payloadHash)) return { item: existing, repeated: true };
        const nextQuantity = existing.quantityOnHand + data.delta;
        if (nextQuantity < 0) throw new ConflictError('This adjustment would make stock negative.');
        if (nextQuantity > 1_000_000) throw new ValidationError('Stock exceeds the supported maximum.');
        const updated = await tx.inventoryItem.update({ where: { id: existing.id }, data: { quantityOnHand: { increment: data.delta } }, include: { branch: true } });
        await tx.stockMovement.create({ data: { inventoryItemId: existing.id, quantity: data.delta, reason: data.reason, idempotencyKey: data.idempotencyKey, idempotencyPayloadHash: payloadHash } });
        const signedQuantity = `${data.delta > 0 ? '+' : ''}${data.delta}`;
        await auditInTransaction(tx, req, 'INVENTORY_ADJUST', 'inventory', existing.id, existing.branchId, `Adjusted ${signedQuantity} ${existing.unit} of ${existing.name}: ${data.reason}`);
        return { item: updated, repeated: false };
    });
    res.status(result.repeated ? 200 : 201).json(serializeInventoryItem(result.item));
};

export const useBookingPart = async (req: Request, res: Response) => {
    const data = usageSchema.parse(req.body);
    const user = requireUser(req);
    const bookingId = resourceIdSchema.parse(req.params.id);
    const payloadHash = movementPayloadHash(user.userId, user.orgId, 'PART_USE', { bookingId, inventoryItemId: data.inventoryItemId, quantity: data.quantity });
    const result = await prisma.$transaction(async (tx) => {
        await lockIdempotencyKey(tx, data.idempotencyKey);
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
        const existing = await tx.booking.findFirst({ where: { id: bookingId, ...branchScopedWhere(user) }, include: { invoice: true } });
        if (!existing) throw new NotFoundError('Booking not found');
        await tx.$queryRaw`SELECT "id" FROM "InventoryItem" WHERE "id" = ${data.inventoryItemId} FOR UPDATE`;
        const item = await tx.inventoryItem.findFirst({ where: { id: data.inventoryItemId, branchId: existing.branchId, ...branchScopedWhere(user) } });
        if (!item) throw new NotFoundError('Choose a part stocked at this booking’s branch.');
        if (await isIdempotentReplay(tx, data.idempotencyKey, payloadHash)) {
            const booking = await tx.booking.findUniqueOrThrow({ where: { id: existing.id }, include: BOOKING_INCLUDE });
            return { booking, repeated: true };
        }
        assertOpen(existing.status);
        if (existing.invoice) throw new ValidationError('Parts are locked after invoicing. Finalize the parts used before issuing the invoice.');
        if (item.quantityOnHand < data.quantity) throw new ConflictError(`Only ${item.quantityOnHand} ${item.unit} remain in stock.`);
        await tx.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: { decrement: data.quantity } } });
        await tx.partUsage.create({ data: { inventoryItemId: item.id, quantity: data.quantity, bookingId: existing.id, unitPrice: item.unitCost } });
        await tx.stockMovement.create({ data: { inventoryItemId: item.id, quantity: -data.quantity, reason: 'Used on work order', bookingId: existing.id, idempotencyKey: data.idempotencyKey, idempotencyPayloadHash: payloadHash } });
        await auditInTransaction(tx, req, 'PART_USE', 'booking', existing.id, existing.branchId, `Used ${data.quantity} ${item.unit} of ${item.name}`);
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: existing.id }, include: BOOKING_INCLUDE });
        return { booking, repeated: false };
    });
    res.status(result.repeated ? 200 : 201).json(serializeBooking(result.booking));
};
