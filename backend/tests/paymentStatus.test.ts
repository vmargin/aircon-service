import { PaymentStatus } from '@prisma/client';
import {
    assertValidPaymentTransition,
    ALLOWED_PAYMENT_TRANSITIONS,
} from '../src/lib/paymentStatus';

describe('payment lifecycle', () => {
    it('allows collecting payment', () => {
        expect(() =>
            assertValidPaymentTransition(PaymentStatus.UNPAID, PaymentStatus.PARTIAL)
        ).not.toThrow();
        expect(() =>
            assertValidPaymentTransition(PaymentStatus.PARTIAL, PaymentStatus.PAID)
        ).not.toThrow();
        expect(() =>
            assertValidPaymentTransition(PaymentStatus.UNPAID, PaymentStatus.PAID)
        ).not.toThrow();
    });

    it('treats PAID as terminal so collected money cannot be zeroed out', () => {
        expect(ALLOWED_PAYMENT_TRANSITIONS[PaymentStatus.PAID]).toHaveLength(0);
        expect(() =>
            assertValidPaymentTransition(PaymentStatus.PAID, PaymentStatus.UNPAID)
        ).toThrow(/already paid/);
        expect(() =>
            assertValidPaymentTransition(PaymentStatus.PAID, PaymentStatus.PARTIAL)
        ).toThrow(/already paid/);
    });

    it('rejects walking a partial payment back to unpaid', () => {
        expect(() =>
            assertValidPaymentTransition(PaymentStatus.PARTIAL, PaymentStatus.UNPAID)
        ).toThrow(/Cannot move payment/);
    });

    it('is a no-op when the status is unchanged', () => {
        // The UI PATCHes the current status when only the payment method changes.
        expect(() =>
            assertValidPaymentTransition(PaymentStatus.PAID, PaymentStatus.PAID)
        ).not.toThrow();
    });
});
