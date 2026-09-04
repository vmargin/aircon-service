import { PaymentStatus } from '@prisma/client';
import { ValidationError } from '../middleware/errorHandler';

/**
 * PAYMENT LIFECYCLE STATE MACHINE
 *
 * UNPAID → PARTIAL → PAID. PAID is terminal.
 *
 * Money that has been collected must not be quietly un-collected: allowing
 * PAID → UNPAID lets someone zero out a settled invoice and walk away with the
 * cash, leaving the books looking correct. Reversing a real payment is a
 * deliberate act that belongs in a refund flow with its own audit trail, not a
 * silent field edit.
 */
export const ALLOWED_PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    [PaymentStatus.UNPAID]: [PaymentStatus.PARTIAL, PaymentStatus.PAID],
    [PaymentStatus.PARTIAL]: [PaymentStatus.PAID],
    [PaymentStatus.PAID]: [],
};

export function assertValidPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
    if (from === to) return; // idempotent no-op

    const allowed = ALLOWED_PAYMENT_TRANSITIONS[from];
    if (!allowed.includes(to)) {
        throw new ValidationError(
            allowed.length === 0
                ? 'This invoice is already paid and cannot be changed. Issue a refund instead.'
                : `Cannot move payment from ${from} to ${to}. Allowed: ${allowed.join(', ')}.`
        );
    }
}
