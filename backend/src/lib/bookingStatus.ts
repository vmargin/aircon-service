import { BookingStatus } from '@prisma/client';
import { ValidationError } from '../middleware/errorHandler';

/**
 * BOOKING LIFECYCLE STATE MACHINE
 *
 * PENDING → CONFIRMED → ON_SITE → COMPLETED
 * Any non-terminal state may be CANCELLED. COMPLETED and CANCELLED are final.
 *
 * Without this, a booking could jump straight from PENDING to COMPLETED,
 * skipping dispatch entirely and corrupting any cycle-time reporting.
 */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    [BookingStatus.CONFIRMED]: [BookingStatus.ON_SITE, BookingStatus.CANCELLED],
    [BookingStatus.ON_SITE]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    [BookingStatus.COMPLETED]: [],
    [BookingStatus.CANCELLED]: [],
};

export function assertValidTransition(from: BookingStatus, to: BookingStatus): void {
    if (from === to) return; // idempotent no-op

    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.includes(to)) {
        throw new ValidationError(
            allowed.length === 0
                ? `A ${from} booking is final and cannot change status.`
                : `Cannot move a booking from ${from} to ${to}. Allowed: ${allowed.join(', ')}.`
        );
    }
}
