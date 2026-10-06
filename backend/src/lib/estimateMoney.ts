import { Prisma } from '@prisma/client';

/** Keep estimate totals inside the same positive amount range as the invoice API. */
export const MAX_ESTIMATE_TOTAL = new Prisma.Decimal('99999999.99');

/** Round each quoted line to cents using an explicit half-up rule. */
export function roundEstimateLineTotal(quantity: Prisma.Decimal, unitPrice: Prisma.Decimal) {
    return quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function sumEstimateLineTotals(totals: Prisma.Decimal[]) {
    return totals.reduce((sum, total) => sum.add(total), new Prisma.Decimal(0));
}
