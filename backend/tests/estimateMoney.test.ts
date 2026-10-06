import { Prisma } from '@prisma/client';
import { MAX_ESTIMATE_TOTAL, roundEstimateLineTotal, sumEstimateLineTotals } from '../src/lib/estimateMoney';

describe('estimate money', () => {
    it('rounds each line to cents with half-up rounding', () => {
        expect(roundEstimateLineTotal(new Prisma.Decimal('0.005'), new Prisma.Decimal('1.00')).toFixed(2)).toBe('0.01');
        expect(roundEstimateLineTotal(new Prisma.Decimal('0.004'), new Prisma.Decimal('1.00')).toFixed(2)).toBe('0.00');
    });

    it('sums Decimal line totals without a floating-point conversion', () => {
        const total = sumEstimateLineTotals([
            new Prisma.Decimal('0.10'),
            new Prisma.Decimal('0.20'),
            roundEstimateLineTotal(new Prisma.Decimal('0.005'), new Prisma.Decimal('1.00')),
        ]);
        expect(total.toFixed(2)).toBe('0.31');
    });

    it('uses the invoice API amount limit', () => {
        expect(MAX_ESTIMATE_TOTAL.toFixed(2)).toBe('99999999.99');
    });
});
