import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, Clock, TrendingUp } from 'lucide-react';

import api, { getList, formatCurrency, formatDate } from '../api/api';
import { Invoice, PAYMENT_METHODS, PaymentStatus } from '../types';
import {
    Card,
    EmptyState,
    ErrorState,
    PageHeader,
    PaymentBadge,
    Spinner,
    cn,
} from './ui';

/**
 * INVOICES
 *
 * Payment status is editable inline. The old page rendered a hardcoded "₱0.00"
 * summary and had no way to record a payment at all.
 */

const FILTERS: Array<{ value: 'ALL' | PaymentStatus; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'UNPAID', label: 'Unpaid' },
    { value: 'PARTIAL', label: 'Partial' },
    { value: 'PAID', label: 'Paid' },
];

const Financials: React.FC = () => {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'ALL' | PaymentStatus>('ALL');
    const [actionError, setActionError] = useState('');

    const query = useQuery({
        queryKey: ['invoices'],
        queryFn: () => getList<Invoice>('/invoices', { limit: 200 }),
    });

    const updatePayment = useMutation({
        mutationFn: ({
            id,
            paymentStatus,
            paymentMethod,
        }: {
            id: string;
            paymentStatus: PaymentStatus;
            paymentMethod?: string;
        }) => api.patch(`/invoices/${id}/payment`, { paymentStatus, paymentMethod }),
        onSuccess: () => {
            setActionError('');
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
        },
        onError: (err: Error) => setActionError(err.message),
    });

    const invoices = query.data ?? [];

    const totals = useMemo(() => {
        const paid = invoices
            .filter((i) => i.paymentStatus === 'PAID')
            .reduce((s, i) => s + Number(i.amount), 0);
        const pending = invoices
            .filter((i) => i.paymentStatus !== 'PAID')
            .reduce((s, i) => s + Number(i.amount), 0);
        return { paid, pending, total: paid + pending };
    }, [invoices]);

    if (query.isLoading) return <Spinner label="Loading invoices…" />;
    if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

    const filtered = invoices.filter((i) => filter === 'ALL' || i.paymentStatus === filter);

    const stats = [
        { label: 'Collected', value: totals.paid, icon: Wallet, tone: 'bg-emerald-50 text-emerald-600' },
        { label: 'Outstanding', value: totals.pending, icon: Clock, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Invoiced', value: totals.total, icon: TrendingUp, tone: 'bg-blue-50 text-blue-600' },
    ];

    return (
        <div>
            <PageHeader title="Invoices" subtitle={`${invoices.length} total`} />

            {actionError && (
                <div className="mb-4">
                    <ErrorState error={new Error(actionError)} />
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
                {stats.map(({ label, value, icon: Icon, tone }) => (
                    <Card key={label} className="p-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center',
                                    tone
                                )}
                            >
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-500">{label}</p>
                                <p className="text-lg font-bold text-slate-800 truncate">
                                    {formatCurrency(value)}
                                </p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-0.5">
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={cn(
                            'px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition',
                            filter === f.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <Card>
                {filtered.length === 0 ? (
                    <EmptyState
                        title="No invoices"
                        message="Invoices are created from the Bookings page once a job is billed."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Customer
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Service
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Issued
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Amount
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Method
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Payment
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-800">
                                                {inv.booking?.customer?.name ?? '—'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {inv.booking?.branch?.name ?? ''}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {inv.booking?.serviceType ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {formatDate(inv.issuedAt)}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                                            {formatCurrency(inv.amount)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={inv.paymentMethod ?? ''}
                                                onChange={(e) =>
                                                    updatePayment.mutate({
                                                        id: inv.id,
                                                        paymentStatus: inv.paymentStatus,
                                                        paymentMethod: e.target.value || undefined,
                                                    })
                                                }
                                                className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                            >
                                                <option value="">—</option>
                                                {PAYMENT_METHODS.map((m) => (
                                                    <option key={m} value={m}>
                                                        {m.replace('_', ' ')}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            {/* Paid is terminal — the API rejects
                                                changes once an invoice is settled. */}
                                            {inv.paymentStatus === 'PAID' ? (
                                                <PaymentBadge status="PAID" />
                                            ) : (
                                                <select
                                                    value={inv.paymentStatus}
                                                    onChange={(e) =>
                                                        updatePayment.mutate({
                                                            id: inv.id,
                                                            paymentStatus: e.target
                                                                .value as PaymentStatus,
                                                            paymentMethod:
                                                                inv.paymentMethod ?? undefined,
                                                        })
                                                    }
                                                    className="px-2 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                >
                                                    <option value="UNPAID">Unpaid</option>
                                                    <option value="PARTIAL">Partial</option>
                                                    <option value="PAID">Paid</option>
                                                </select>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default Financials;
