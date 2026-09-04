import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import api, { formatCurrency } from '../api/api';
import { Booking, PAYMENT_METHODS } from '../types';
import { Button, Field, inputClass } from './ui';
import Modal from './Modal';

/**
 * INVOICE CREATION
 *
 * Two things the old flow got wrong:
 *  1. Amount was posted as a float built from a raw string, so "12.345" was
 *     silently accepted. It's now validated to two decimals before sending.
 *  2. Billing a job left it in ON_SITE, forcing the user back to the table to
 *     change status separately. If "mark completed" is checked we make that
 *     follow-up PATCH here, but only when the transition is legal.
 */
const InvoiceModal: React.FC<{ booking: Booking | null; onClose: () => void }> = ({
    booking,
    onClose,
}) => {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [markPaid, setMarkPaid] = useState(false);
    const [markCompleted, setMarkCompleted] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setAmount('');
        setPaymentMethod('');
        setMarkPaid(false);
        // Only pre-check completion when the booking can actually move there.
        setMarkCompleted(booking?.status === 'ON_SITE');
        setError('');
    }, [booking]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!booking) return;

            const parsed = Number(amount);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                throw new Error('Enter an amount greater than zero.');
            }

            const { data: invoice } = await api.post('/invoices', {
                bookingId: booking.id,
                // Round to cents so the Decimal column never rejects the value.
                amount: Math.round(parsed * 100) / 100,
                ...(paymentMethod ? { paymentMethod } : {}),
            });

            if (markPaid) {
                await api.patch(`/invoices/${invoice.id}/payment`, {
                    paymentStatus: 'PAID',
                    ...(paymentMethod ? { paymentMethod } : {}),
                });
            }

            // ON_SITE → COMPLETED is the only legal jump from here.
            if (markCompleted && booking.status === 'ON_SITE') {
                await api.patch(`/bookings/${booking.id}`, { status: 'COMPLETED' });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            onClose();
        },
        onError: (err: Error) => setError(err.message),
    });

    const preview = Number(amount);

    return (
        <Modal
            isOpen={Boolean(booking)}
            onClose={onClose}
            title="Create invoice"
            subtitle={
                booking ? `${booking.customer?.name ?? 'Customer'} · ${booking.serviceType}` : ''
            }
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setError('');
                    mutation.mutate();
                }}
                className="p-5 space-y-4"
            >
                <Field label="Amount (PHP)" htmlFor="amount">
                    <input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        autoFocus
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className={inputClass}
                    />
                    {Number.isFinite(preview) && preview > 0 && (
                        <p className="text-xs text-slate-500">Total: {formatCurrency(preview)}</p>
                    )}
                </Field>

                <Field label="Payment method" htmlFor="method" hint="Optional until payment is received.">
                    <select
                        id="method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Not specified</option>
                        {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                                {m.replace('_', ' ')}
                            </option>
                        ))}
                    </select>
                </Field>

                <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl cursor-pointer">
                    <input
                        type="checkbox"
                        checked={markPaid}
                        onChange={(e) => setMarkPaid(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Payment already collected</span>
                </label>

                {booking?.status === 'ON_SITE' && (
                    <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl cursor-pointer">
                        <input
                            type="checkbox"
                            checked={markCompleted}
                            onChange={(e) => setMarkCompleted(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">Mark this job completed</span>
                    </label>
                )}

                {error && (
                    <p role="alert" className="text-xs text-rose-600 font-medium">
                        {error}
                    </p>
                )}

                <div className="flex gap-2 pt-1">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button type="submit" loading={mutation.isPending} className="flex-1">
                        Create invoice
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default InvoiceModal;
