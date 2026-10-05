import { PaymentStatus, Prisma } from '@prisma/client';
import { invoiceFinancials, moneyField } from '../src/lib/money';

describe('exact receipts and historical billing', () => {
    it('sums decimal receipts exactly and derives the remaining balance', () => {
        const result = invoiceFinancials({ amount: new Prisma.Decimal('100.10'), ledgerEnabled: true, paymentStatus: PaymentStatus.UNPAID, payments: [{ amount: new Prisma.Decimal('33.35') }, { amount: new Prisma.Decimal('60.00') }] });
        expect(result).toMatchObject({ amountPaid: '93.35', balance: '6.75', paymentStatus: PaymentStatus.PARTIAL, needsReview: false });
    });
    it('preserves unknown legacy partial amounts rather than inventing a receipt', () => {
        expect(invoiceFinancials({ amount: new Prisma.Decimal('4000'), ledgerEnabled: false, paymentStatus: PaymentStatus.PARTIAL, payments: [] })).toMatchObject({ amountPaid: null, balance: null, needsReview: true, paymentStatus: PaymentStatus.PARTIAL });
    });
    it('preserves a historical settled invoice without creating new receipts', () => {
        expect(invoiceFinancials({ amount: new Prisma.Decimal('4000'), ledgerEnabled: false, paymentStatus: PaymentStatus.PAID, payments: [] })).toMatchObject({ amountPaid: '4000.00', balance: '0.00', legacyBaseline: true });
    });
    it.each([0, -1, 10.001, '1e3', 'NaN', '100000000'])('rejects invalid or inexact amount %s', (amount) => {
        expect(moneyField.safeParse(amount).success).toBe(false);
    });
});
