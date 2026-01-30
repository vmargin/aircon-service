import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';

const createItemSchema = z.object({
    name: z.string().min(1),
    sku: z.string().min(1).optional(),
    branchId: z.string().uuid(),
    quantity: z.number().int().optional().default(0),
    unitCost: z.number().positive().optional(),
});

const transactionSchema = z.object({
    itemId: z.string().uuid(),
    change: z.number().int(),
    bookingId: z.string().uuid().optional(),
    description: z.string().optional(),
});

export const getInventory = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const items = await prisma.inventoryItem.findMany({
            where: {
                branch: {
                    organizationId: user.orgId,
                },
            },
            include: {
                branch: true,
            },
            orderBy: { name: 'asc' },
        });

        res.json(items);
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
};

export const createInventoryItem = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const validation = createItemSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0].message });
    }

    try {
        const item = await prisma.inventoryItem.create({
            data: validation.data,
        });

        res.status(201).json(item);
    } catch (error) {
        console.error('Create inventory item error:', error);
        res.status(500).json({ error: 'Failed to create inventory item' });
    }
};

export const getInventoryTransactions = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const transactions = await prisma.inventoryTransaction.findMany({
            where: {
                item: {
                    branch: {
                        organizationId: user.orgId,
                    },
                },
            },
            include: {
                item: true,
                booking: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        res.json(transactions);
    } catch (error) {
        console.error('Get inventory transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory transactions' });
    }
};

export const createInventoryTransaction = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const validation = transactionSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const { itemId, change, bookingId, description } = validation.data;

    try {
        const item = await prisma.inventoryItem.findFirst({
            where: {
                id: itemId,
                branch: {
                    organizationId: user.orgId,
                },
            },
        });

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const transaction = await prisma.$transaction(async (tx) => {
            const updatedItem = await tx.inventoryItem.update({
                where: { id: itemId },
                data: {
                    quantity: {
                        increment: change,
                    },
                },
            });

            if (updatedItem.quantity < 0) {
                throw new Error('Inventory cannot go below zero');
            }

            const createdTx = await tx.inventoryTransaction.create({
                data: {
                    itemId,
                    bookingId,
                    change,
                    description,
                },
            });

            return { transaction: createdTx, item: updatedItem };
        });

        res.status(201).json(transaction);
    } catch (error: any) {
        console.error('Create inventory transaction error:', error);
        if (error.message === 'Inventory cannot go below zero') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create inventory transaction' });
    }
};

