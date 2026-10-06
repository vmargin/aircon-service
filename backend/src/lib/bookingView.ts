import { Prisma } from '@prisma/client';
import { serializeInvoice } from './money';

export const BOOKING_INCLUDE = {
    customer: true, branch: true, technician: true, unit: true,
    serviceSite: true,
    serviceRequest: { select: { reportedIssue: true, preferredWindowStart: true, preferredWindowEnd: true, accessNotes: true } },
    estimateRevision: { include: { lineItems: { orderBy: { sortOrder: 'asc' as const } } } },
    invoice: { include: { payments: { orderBy: { createdAt: 'asc' as const } }, lineItems: { orderBy: { sortOrder: 'asc' as const } } } },
    parts: { include: { inventoryItem: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.BookingInclude;

type BookingView = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;
export function serializeBooking(booking: BookingView) {
    return {
        ...booking,
        estimateRevision: booking.estimateRevision ? {
            ...booking.estimateRevision,
            total: booking.estimateRevision.lineItems.reduce(
                (sum, line) => sum.add(line.lineTotal),
                new Prisma.Decimal(0),
            ).toFixed(2),
            lineItems: booking.estimateRevision.lineItems.map((line) => ({
                ...line,
                quantity: line.quantity.toFixed(3),
                unitPrice: line.unitPrice.toFixed(2),
                lineTotal: line.lineTotal.toFixed(2),
            })),
        } : null,
        invoice: booking.invoice ? serializeInvoice(booking.invoice) : null,
        parts: booking.parts.map((part) => ({
            ...part, unitPrice: part.unitPrice.toFixed(2), unitPriceCents: part.unitPrice.mul(100).toNumber(),
            inventoryItem: { ...part.inventoryItem, unitCost: part.inventoryItem.unitCost.toFixed(2) },
        })),
    };
}
