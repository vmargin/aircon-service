import { BookingStatus } from '@prisma/client';
import { assertValidTransition, ALLOWED_TRANSITIONS } from '../src/lib/bookingStatus';

describe('booking lifecycle', () => {
    it('allows each forward step', () => {
        expect(() =>
            assertValidTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED)
        ).not.toThrow();
        expect(() =>
            assertValidTransition(BookingStatus.CONFIRMED, BookingStatus.ON_SITE)
        ).not.toThrow();
        expect(() =>
            assertValidTransition(BookingStatus.ON_SITE, BookingStatus.COMPLETED)
        ).not.toThrow();
    });

    it('rejects skipping dispatch', () => {
        expect(() =>
            assertValidTransition(BookingStatus.PENDING, BookingStatus.COMPLETED)
        ).toThrow(/Cannot move a booking/);
    });

    it('rejects moving backwards', () => {
        expect(() =>
            assertValidTransition(BookingStatus.ON_SITE, BookingStatus.PENDING)
        ).toThrow();
    });

    it('treats COMPLETED and CANCELLED as final', () => {
        expect(ALLOWED_TRANSITIONS[BookingStatus.COMPLETED]).toHaveLength(0);
        expect(ALLOWED_TRANSITIONS[BookingStatus.CANCELLED]).toHaveLength(0);
        expect(() =>
            assertValidTransition(BookingStatus.COMPLETED, BookingStatus.PENDING)
        ).toThrow(/final/);
    });

    it('allows cancelling from any open state', () => {
        for (const from of [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.ON_SITE,
        ]) {
            expect(() => assertValidTransition(from, BookingStatus.CANCELLED)).not.toThrow();
        }
    });

    it('is a no-op when the status is unchanged', () => {
        expect(() =>
            assertValidTransition(BookingStatus.COMPLETED, BookingStatus.COMPLETED)
        ).not.toThrow();
    });
});
