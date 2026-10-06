import { BookingPriority, BookingStatus, Prisma } from '@prisma/client';
import { TERMINAL_STATUSES } from './dispatch';

export function attentionBookingWhere(now: Date = new Date()): Prisma.BookingWhereInput {
    return {
        OR: [
            {
                status: { notIn: TERMINAL_STATUSES },
                OR: [
                    { priority: { in: [BookingPriority.HIGH, BookingPriority.URGENT] } },
                    { scheduledAt: { lt: now } },
                ],
            },
            { status: BookingStatus.COMPLETED, invoice: { is: null } },
            {
                status: { not: BookingStatus.CANCELLED },
                checklist: { array_contains: [{ outcome: 'PENDING' }] },
            },
            {
                status: { not: BookingStatus.CANCELLED },
                checklist: { array_contains: [{ outcome: 'FOLLOW_UP' }] },
            },
        ],
    };
}
