import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { logAudit } from '../lib/auditLog';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { requireUser } from '../middleware/auth';
import { isBranchScoped } from '../lib/tenancy';
import { parsePagination, toPage } from '../lib/pagination';

const createInvoiceSchema = z.object({
    bookingId: z.string().uuid(),
    // Two decimal places max — money is stored as Decimal(12,2).
    amount: z
        .number()
        .positive()
        .max(99_999_999)
        .refine((n) => Number.isInteger(Math.round(n * 100)) && Math.round(n * 100) / 100 === n, {
            message: 'Amount cannot have more than 2 decimal places',
        }),
    paymentMethod: z.enum(['CASH', 'E_WALLET', 'BANK', 'CHEQUE']).optional(),
});

const updatePaymentSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus),
    paymentMethod: z.enum(['CASH', 'E_WALLET', 'BANK', 'CHEQUE']).optional(),
});

const listInvoicesSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    branchId: z.string().uuid().optional(),
});

/** Invoices reach the tenant through their booking's branch. */
function invoiceScopedWhere(user: ReturnType<typeof requireUser>): Prisma.InvoiceWhereInput {
    return {
        booking: {
            branch: { organizationId: user.orgId },
            ...(isBranchScoped(user) ? { branchId: user.branchId } : {}),
        },
    };
}

export const getInvoices = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = listInvoicesSchema.parse(req.query);

    const where: Prisma.InvoiceWhereInput = invoiceScopedWhere(user);
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;

    if (filters.branchId && user.role === UserRole.ADMIN) {
        where.booking = { ...(where.booking as object), branchId: filters.branchId };
    }

    const [invoices, total] = await prisma.$transaction([
        prisma.invoice.findMany({
            where,
            include: { booking: { include: { customer: true, branch: true } } },
            orderBy: { issuedAt: 'desc' },
            skip,
            take,
        }),
        prisma.invoice.count({ where }),
    ]);

    res.json(toPage(invoices, total, page, limit));
};

export const createInvoice = async (req: Request, res: Response) => {
    const user = requireUser(req);

    const validation = createInvoiceSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    const { bookingId, amount, paymentMethod } = validation.data;

    // Resolve the booking inside the caller's scope — this is what authorises
    // the write, rather than trusting the branchId on the request.
    const booking = await prisma.booking.findFirst({
        where: {
            id: bookingId,
            branch: { organizationId: user.orgId },
            ...(isBranchScoped(user) ? { branchId: user.branchId } : {}),
        },
        include: { invoice: true },
    });

    if (!booking) throw new NotFoundError('Booking not found');

    // Invoice.bookingId is unique; check first so the caller gets a clear 409.
    if (booking.invoice) {
        throw new ConflictError('This booking has already been invoiced.');
    }

    const invoice = await prisma.invoice.create({
        data: {
            bookingId,
            amount: new Prisma.Decimal(amount.toFixed(2)),
            paymentMethod,
            paymentStatus: PaymentStatus.UNPAID,
        },
    });

    await logAudit(req, 'INVOICE_CREATE', 'invoice', invoice.id, booking.branchId);
    res.status(201).json(invoice);
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const validation = updatePaymentSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    const invoice = await prisma.invoice.findFirst({
        where: { id, ...invoiceScopedWhere(user) },
        include: { booking: { select: { branchId: true } } },
    });

    if (!invoice) throw new NotFoundError('Invoice not found');

    const { paymentStatus, paymentMethod } = validation.data;

    const updated = await prisma.invoice.update({
        where: { id },
        data: {
            paymentStatus,
            paymentMethod,
            // Stamp on transition into PAID, clear it on the way back out.
            paidAt: paymentStatus === PaymentStatus.PAID ? (invoice.paidAt ?? new Date()) : null,
        },
    });

    await logAudit(
        req,
        'INVOICE_PAYMENT_UPDATE',
        'invoice',
        id,
        invoice.booking.branchId,
        `payment: ${invoice.paymentStatus} -> ${paymentStatus}`
    );
    res.json(updated);
};
