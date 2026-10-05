import { Prisma } from '@prisma/client';
import { serializeInvoice } from './money';

export const BOOKING_INCLUDE = {
    customer: true, branch: true, technician: true, unit: true,
    invoice: { include: { payments: { orderBy: { createdAt: 'asc' as const } } } },
    parts: { include: { inventoryItem: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.BookingInclude;

type BookingView = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;
export function serializeBooking(booking: BookingView) {
    return {
        ...booking,
        invoice: booking.invoice ? serializeInvoice(booking.invoice) : null,
        parts: booking.parts.map((part) => ({
            ...part, unitPrice: part.unitPrice.toFixed(2), unitPriceCents: part.unitPrice.mul(100).toNumber(),
            inventoryItem: { ...part.inventoryItem, unitCost: part.inventoryItem.unitCost.toFixed(2) },
        })),
    };
}
