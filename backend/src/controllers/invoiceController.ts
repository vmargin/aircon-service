import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { PaymentStatus, UserRole } from '@prisma/client';

const createInvoiceSchema = z.object({
    bookingId: z.string().uuid(),
    amount: z.number().positive(),
    paymentMethod: z.string().optional(),
});

const updatePaymentSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus),
    paymentMethod: z.string().optional(),
});

export const createInvoice = async (req: Request, res: Response) => {
    const { user } = req;

    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const validation = createInvoiceSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const { bookingId, amount, paymentMethod } = validation.data;

    try {
        const booking = await prisma.booking.findFirst({
            where: {
                id: bookingId,
                branch: { organizationId: user.orgId }
            },
            include: { branch: true }
        });

        if (!booking) return res.status(404).json({ error: "Booking not found" });

        if (user.role === UserRole.BRANCH_LEADER && user.branchId && booking.branchId !== user.branchId) {
            return res.status(403).json({ error: "Cannot create invoice for another branch's booking" });
        }

        const invoice = await prisma.invoice.create({
            data: {
                bookingId: String(bookingId),
                amount: amount,
                paymentMethod,
                paymentStatus: PaymentStatus.UNPAID,
            }
        });

        res.status(201).json(invoice);
    } catch (error) {
        console.error("Create invoice error:", error);
        res.status(500).json({ error: "Failed to create invoice" });
    }
};

export const getInvoices = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const baseWhere = {
            booking: {
                branch: { organizationId: user.orgId }
            }
        };

        const where =
            user.role === UserRole.BRANCH_LEADER && user.branchId
                ? {
                    ...baseWhere,
                    booking: {
                        ...baseWhere.booking,
                        branchId: user.branchId
                    }
                }
                : baseWhere;

        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                booking: {
                    include: { customer: true, branch: true }
                }
            },
            orderBy: { issuedAt: 'desc' }
        });
        res.json(invoices);
    } catch (error) {
        console.error("Get invoices error:", error);
        res.status(500).json({ error: "Failed to fetch invoices" });
    }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
    const { user } = req;
    const { id } = req.params as { id: string };

    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const validation = updatePaymentSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues[0].message });
    }

    try {
        const invoice = await prisma.invoice.findFirst({
            where: {
                id,
                booking: { branch: { organizationId: user.orgId } }
            },
            include: { booking: { select: { branchId: true } } }
        });

        if (!invoice) return res.status(404).json({ error: "Invoice not found" });

        if (user.role === UserRole.BRANCH_LEADER && user.branchId && invoice.booking.branchId !== user.branchId) {
            return res.status(403).json({ error: "Cannot update payment for another branch's invoice" });
        }

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                paymentStatus: validation.data.paymentStatus,
                paymentMethod: validation.data.paymentMethod,
                paidAt: validation.data.paymentStatus === PaymentStatus.PAID ? new Date() : undefined
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: "Failed to update payment" });
    }
};
