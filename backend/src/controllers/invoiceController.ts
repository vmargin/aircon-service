import { Request, Response } from 'express';
import { z } from 'zod';
import { BookingStatus, EstimateStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import prisma from '../db/prisma';
import { auditInTransaction } from '../lib/auditLog';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { requireUser } from '../middleware/auth';
import { branchScopedWhere, isBranchScoped } from '../lib/tenancy';
import { parsePagination, toPage } from '../lib/pagination';
import { invoiceFinancials, moneyField, serializeInvoice } from '../lib/money';
import { MAX_ESTIMATE_TOTAL, roundEstimateLineTotal, sumEstimateLineTotals } from '../lib/estimateMoney';

const createSchema = z.object({ bookingId: z.string().uuid(), amount: moneyField.optional(), paymentMethod: z.enum(['CASH', 'E_WALLET', 'BANK', 'CHEQUE']).optional() });
const paymentSchema = z.object({ amount: moneyField, method: z.enum(['CASH', 'E_WALLET', 'BANK', 'CHEQUE']), reference: z.string().trim().max(120).optional(), idempotencyKey: z.string().min(8).max(120) });
const listSchema = z.object({ paymentStatus: z.nativeEnum(PaymentStatus).optional(), branchId: z.string().uuid().optional() });
const INVOICE_INCLUDE = {
    payments: { orderBy: { createdAt: 'asc' as const } },
    lineItems: { orderBy: { sortOrder: 'asc' as const } },
    booking: { include: { customer: true, branch: true, unit: true, technician: true, serviceSite: true } },
} satisfies Prisma.InvoiceInclude;

export function invoiceScopedWhere(user: ReturnType<typeof requireUser>): Prisma.InvoiceWhereInput {
    return { booking: { branch: { organizationId: user.orgId }, ...(isBranchScoped(user) ? { branchId: user.branchId } : {}) } };
}

export const getInvoices = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { page, limit, skip, take } = parsePagination(req.query);
    const filters = listSchema.parse(req.query);
    const where: Prisma.InvoiceWhereInput = invoiceScopedWhere(user);
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters.branchId && user.role === UserRole.ADMIN) where.booking = { ...(where.booking as object), branchId: filters.branchId };
    const [invoices, total] = await prisma.$transaction([
        prisma.invoice.findMany({ where, include: INVOICE_INCLUDE, orderBy: { issuedAt: 'desc' }, skip, take }),
        prisma.invoice.count({ where }),
    ]);
    res.json(toPage(invoices.map(serializeInvoice), total, page, limit));
};

export const createInvoice = async (req: Request, res: Response) => {
    const data = createSchema.parse(req.body);
    const invoice = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${data.bookingId} FOR UPDATE`;
        const user = requireUser(req);
        const booking = await tx.booking.findFirst({ where: { id: data.bookingId, ...branchScopedWhere(user) }, include: { invoice: true } });
        if (!booking) throw new NotFoundError('Booking not found');
        if (booking.status === BookingStatus.CANCELLED) throw new ValidationError('A cancelled work order cannot be invoiced.');
        if (booking.invoice) throw new ConflictError('This booking has already been invoiced.');
        let invoiceData: Prisma.InvoiceCreateInput;
        if (booking.estimateRevisionId) {
            if (data.amount !== undefined) throw new ValidationError('This approved estimate determines the invoice total; remove the manual amount.');
            const revision = await tx.estimateRevision.findUnique({
                where: { id: booking.estimateRevisionId },
                include: { lineItems: { orderBy: { sortOrder: 'asc' } }, estimate: { include: { serviceRequest: { include: { booking: true } } } } },
            });
            if (!revision || revision.status !== EstimateStatus.APPROVED || revision.supersededAt || revision.estimate.serviceRequest.booking?.id !== booking.id) {
                throw new ConflictError('The approved estimate no longer matches this work order.');
            }
            const latest = await tx.estimateRevision.findFirst({ where: { estimateId: revision.estimateId, supersededAt: null }, orderBy: { revisionNumber: 'desc' } });
            if (!latest || latest.id !== revision.id) throw new ConflictError('Only the current approved estimate can be invoiced.');
            if (revision.lineItems.length === 0) throw new ValidationError('The approved estimate has no invoice lines.');
            const total = sumEstimateLineTotals(revision.lineItems.map((line) => {
                const expected = roundEstimateLineTotal(line.quantity, line.unitPrice);
                if (!expected.eq(line.lineTotal)) throw new ConflictError('An approved estimate line has an invalid saved total.');
                return line.lineTotal;
            }));
            if (total.gt(MAX_ESTIMATE_TOTAL)) throw new ConflictError('The approved estimate exceeds the supported invoice total.');
            invoiceData = {
                booking: { connect: { id: booking.id } },
                estimateRevision: { connect: { id: revision.id } },
                amount: total,
                paymentMethod: data.paymentMethod,
                ledgerEnabled: true,
                lineItems: {
                    create: revision.lineItems.map((line) => ({
                        sourceLine: { connect: { id: line.id } },
                        description: line.description,
                        quantity: line.quantity,
                        unitPrice: line.unitPrice,
                        lineTotal: line.lineTotal,
                        sortOrder: line.sortOrder,
                    })),
                },
            };
        } else {
            if (!data.amount) throw new ValidationError('Enter an invoice amount for a booking without an approved estimate.');
            invoiceData = {
                booking: { connect: { id: booking.id } },
                amount: data.amount,
                paymentMethod: data.paymentMethod,
                ledgerEnabled: true,
            };
        }
        const result = await tx.invoice.create({ data: invoiceData, include: INVOICE_INCLUDE });
        await auditInTransaction(tx, req, 'INVOICE_CREATE', 'invoice', result.id, booking.branchId, `Invoice issued for ₱${result.amount.toFixed(2)}`);
        return result;
    });
    res.status(201).json(serializeInvoice(invoice));
};

export const recordPayment = async (req: Request, res: Response) => {
    const data = paymentSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const invoice = await tx.invoice.findFirst({ where: { id: req.params.id, ...invoiceScopedWhere(requireUser(req)) }, include: INVOICE_INCLUDE });
        if (!invoice) throw new NotFoundError('Invoice not found');
        const existing = await tx.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
        if (existing) {
            if (existing.invoiceId !== invoice.id || !existing.amount.eq(data.amount) || existing.method !== data.method || (existing.reference ?? '') !== (data.reference ?? '')) throw new ConflictError('This payment key has already been used with different details.');
            return { invoice, repeated: true };
        }
        const financials = invoiceFinancials(invoice);
        if (financials.needsReview) throw new ConflictError('Historical partial payment amount is unknown. Reconcile this invoice before recording additional payments.');
        if (data.amount.gt(new Prisma.Decimal(financials.balance!))) throw new ValidationError('Payment exceeds the outstanding balance.');
        await tx.payment.create({ data: {
            amount: data.amount,
            method: data.method,
            ...(data.reference !== undefined ? { reference: data.reference } : {}),
            idempotencyKey: data.idempotencyKey,
            invoice: { connect: { id: invoice.id } },
        } });
        const nextPaid = new Prisma.Decimal(financials.amountPaid!).add(data.amount);
        const paid = nextPaid.eq(invoice.amount);
        const updated = await tx.invoice.update({ where: { id: invoice.id }, data: { ledgerEnabled: true, paymentStatus: paid ? PaymentStatus.PAID : PaymentStatus.PARTIAL, paymentMethod: data.method, paidAt: paid ? new Date() : null }, include: INVOICE_INCLUDE });
        await auditInTransaction(tx, req, 'PAYMENT_RECORD', 'invoice', invoice.id, invoice.booking.branchId, `Received ₱${data.amount.toFixed(2)} by ${data.method}`);
        return { invoice: updated, repeated: false };
    });
    res.status(result.repeated ? 200 : 201).json(serializeInvoice(result.invoice));
};

/** Keep the old route available, but never fabricate a receipt from a status. */
export const updatePaymentStatus = async (req: Request, res: Response) => {
    if (req.body.amount !== undefined) {
        req.body = { ...req.body, method: req.body.method ?? req.body.paymentMethod };
        return recordPayment(req, res);
    }
    const { paymentStatus } = z.object({ paymentStatus: z.nativeEnum(PaymentStatus) }).parse(req.body);
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, ...invoiceScopedWhere(requireUser(req)) }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundError('Invoice not found');
    if (invoiceFinancials(invoice).paymentStatus !== paymentStatus) throw new ValidationError('Payment status is derived from receipts. Record the actual amount and method through the payment form.');
    res.json(serializeInvoice(invoice));
};
