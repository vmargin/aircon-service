import { Invoice, Payment, PaymentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

/** Validate decimal input before converting it; all arithmetic stays in Decimal. */
export const moneyField = z.union([z.number(), z.string()]).transform(String).refine(
    (value) => /^\d{1,8}(?:\.\d{1,2})?$/.test(value) && new Prisma.Decimal(value).gt(0),
    'Enter a positive amount with at most two decimal places (maximum ₱99,999,999.99).'
).transform((value) => new Prisma.Decimal(value));

export const costField = z.union([z.number(), z.string()]).transform(String).refine(
    (value) => /^\d{1,8}(?:\.\d{1,2})?$/.test(value),
    'Enter a nonnegative amount with at most two decimal places.'
).transform((value) => new Prisma.Decimal(value));

export function invoiceFinancials(invoice: Pick<Invoice, 'amount' | 'paymentStatus' | 'ledgerEnabled'> & { payments: Pick<Payment, 'amount'>[] }) {
    // Historical PARTIAL records have no recorded amount. Inventing a receipt
    // would corrupt the ledger, so explicitly return unknown until reconciled.
    if (!invoice.ledgerEnabled && invoice.paymentStatus === PaymentStatus.PARTIAL) {
        return { amountPaid: null, balance: null, paymentStatus: PaymentStatus.PARTIAL, needsReview: true, legacyBaseline: false };
    }
    const legacyBaseline = !invoice.ledgerEnabled && invoice.paymentStatus === PaymentStatus.PAID;
    const paid = legacyBaseline
        ? invoice.amount
        : invoice.payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
    const balance = invoice.amount.sub(paid);
    return {
        amountPaid: paid.toFixed(2), balance: balance.toFixed(2),
        paymentStatus: paid.gte(invoice.amount) ? PaymentStatus.PAID : paid.gt(0) ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID,
        needsReview: false, legacyBaseline,
    };
}

export function serializeInvoice<T extends Invoice & { payments: Payment[] }>(invoice: T) {
    return {
        ...invoice, amount: invoice.amount.toFixed(2), ...invoiceFinancials(invoice),
        payments: invoice.payments.map((payment) => ({ ...payment, amount: payment.amount.toFixed(2) })),
    };
}
