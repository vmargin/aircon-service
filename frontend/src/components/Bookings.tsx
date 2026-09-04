import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Receipt, UserPlus, Trash2 } from 'lucide-react';

import api, { getList, formatCurrency, formatDate } from '../api/api';
import {
    ALLOWED_TRANSITIONS,
    Booking,
    BookingStatus,
    STATUS_LABELS,
    Technician,
} from '../types';
import {
    Button,
    Card,
    EmptyState,
    ErrorState,
    PageHeader,
    PaymentBadge,
    Spinner,
    StatusBadge,
    inputClass,
} from './ui';
import BookingModal from './BookingModal';
import InvoiceModal from './InvoiceModal';

/**
 * BOOKINGS
 *
 * The job board. Every mutation invalidates the shared 'bookings' key so the
 * dashboard, reports and this table can't drift out of sync.
 */

const STATUS_FILTERS: Array<{ value: 'ALL' | BookingStatus; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'ON_SITE', label: 'On site' },
    { value: 'COMPLETED', label: 'Completed' },
];

const Bookings: React.FC = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | BookingStatus>('ALL');
    const [bookingModalOpen, setBookingModalOpen] = useState(false);
    const [invoiceFor, setInvoiceFor] = useState<Booking | null>(null);
    const [actionError, setActionError] = useState('');

    const bookingsQuery = useQuery({
        queryKey: ['bookings'],
        queryFn: () => getList<Booking>('/bookings', { limit: 200 }),
    });

    const techniciansQuery = useQuery({
        queryKey: ['technicians'],
        queryFn: () => getList<Technician>('/technicians'),
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
    };

    const patchBooking = useMutation({
        mutationFn: ({ id, ...body }: { id: string } & Partial<Booking>) =>
            api.patch(`/bookings/${id}`, body),
        onSuccess: () => {
            setActionError('');
            invalidate();
        },
        onError: (err: Error) => setActionError(err.message),
    });

    const deleteBooking = useMutation({
        mutationFn: (id: string) => api.delete(`/bookings/${id}`),
        onSuccess: () => {
            setActionError('');
            invalidate();
        },
        onError: (err: Error) => setActionError(err.message),
    });

    const bookings = bookingsQuery.data ?? [];
    const technicians = techniciansQuery.data ?? [];

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return bookings
            .filter((b) => statusFilter === 'ALL' || b.status === statusFilter)
            .filter(
                (b) =>
                    !term ||
                    b.customer?.name.toLowerCase().includes(term) ||
                    b.customer?.phone.includes(term) ||
                    b.serviceType.toLowerCase().includes(term)
            )
            .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
    }, [bookings, search, statusFilter]);

    if (bookingsQuery.isLoading) return <Spinner label="Loading bookings…" />;
    if (bookingsQuery.isError) {
        return <ErrorState error={bookingsQuery.error} onRetry={() => bookingsQuery.refetch()} />;
    }

    return (
        <div>
            <PageHeader
                title="Bookings"
                subtitle={`${bookings.length} total`}
                action={
                    <Button onClick={() => setBookingModalOpen(true)}>
                        <Plus className="w-4 h-4" /> New booking
                    </Button>
                }
            />

            {actionError && (
                <div className="mb-4">
                    <ErrorState error={new Error(actionError)} />
                </div>
            )}

            <Card className="mb-4 p-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search customer, phone or service…"
                            className={`${inputClass} pl-9`}
                        />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                        {STATUS_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                                    statusFilter === f.value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            <Card>
                {filtered.length === 0 ? (
                    <EmptyState
                        title="No bookings found"
                        message={
                            bookings.length === 0
                                ? 'Create your first booking to get started.'
                                : 'Try a different search or filter.'
                        }
                        action={
                            bookings.length === 0 ? (
                                <Button onClick={() => setBookingModalOpen(true)}>
                                    <Plus className="w-4 h-4" /> New booking
                                </Button>
                            ) : undefined
                        }
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
                                        Schedule
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Technician
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Invoice
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((b) => {
                                    // Only offer transitions the API will accept.
                                    const nextStates = ALLOWED_TRANSITIONS[b.status];
                                    const branchTechs = technicians.filter(
                                        (t) => t.branchId === b.branchId && t.isActive
                                    );

                                    return (
                                        <tr key={b.id} className="hover:bg-slate-50/70 transition">
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-slate-800">
                                                    {b.customer?.name ?? '—'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {b.customer?.phone ?? ''}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {b.serviceType}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {formatDate(b.scheduledAt, true)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {/* Inline assignment — the old flow needed a
                                                    separate modal for a single dropdown. */}
                                                <select
                                                    value={b.technicianId ?? ''}
                                                    disabled={
                                                        b.status === 'COMPLETED' ||
                                                        b.status === 'CANCELLED'
                                                    }
                                                    onChange={(e) =>
                                                        patchBooking.mutate({
                                                            id: b.id,
                                                            technicianId: e.target.value || null,
                                                        })
                                                    }
                                                    className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-slate-500"
                                                >
                                                    <option value="">Unassigned</option>
                                                    {branchTechs.map((t) => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.name}
                                                        </option>
                                                    ))}
                                                    {/* Keep the current tech visible even if
                                                        they've since been deactivated. */}
                                                    {b.technician &&
                                                        !branchTechs.some(
                                                            (t) => t.id === b.technicianId
                                                        ) && (
                                                            <option value={b.technician.id}>
                                                                {b.technician.name} (inactive)
                                                            </option>
                                                        )}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                {nextStates.length === 0 ? (
                                                    <StatusBadge status={b.status} />
                                                ) : (
                                                    <select
                                                        value={b.status}
                                                        onChange={(e) =>
                                                            patchBooking.mutate({
                                                                id: b.id,
                                                                status: e.target
                                                                    .value as BookingStatus,
                                                            })
                                                        }
                                                        className="px-2 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                    >
                                                        <option value={b.status}>
                                                            {STATUS_LABELS[b.status]}
                                                        </option>
                                                        {nextStates.map((s) => (
                                                            <option key={s} value={s}>
                                                                → {STATUS_LABELS[s]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {b.invoice ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-700 font-medium whitespace-nowrap">
                                                            {formatCurrency(b.invoice.amount)}
                                                        </span>
                                                        <PaymentBadge
                                                            status={b.invoice.paymentStatus}
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">
                                                        Not billed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {!b.invoice && b.status !== 'CANCELLED' && (
                                                        <button
                                                            onClick={() => setInvoiceFor(b)}
                                                            title="Create invoice"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                                        >
                                                            <Receipt className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {!b.technicianId &&
                                                        b.status === 'PENDING' && (
                                                            <span
                                                                title="Needs a technician"
                                                                className="p-2 text-amber-500"
                                                            >
                                                                <UserPlus className="w-4 h-4" />
                                                            </span>
                                                        )}
                                                    {/* Only un-invoiced jobs can be deleted;
                                                        the API blocks the rest anyway. */}
                                                    {!b.invoice && (
                                                        <button
                                                            onClick={() => {
                                                                if (
                                                                    window.confirm(
                                                                        `Delete the booking for ${b.customer?.name ?? 'this customer'}?`
                                                                    )
                                                                ) {
                                                                    deleteBooking.mutate(b.id);
                                                                }
                                                            }}
                                                            title="Delete booking"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <BookingModal isOpen={bookingModalOpen} onClose={() => setBookingModalOpen(false)} />
            <InvoiceModal booking={invoiceFor} onClose={() => setInvoiceFor(null)} />
        </div>
    );
};

export default Bookings;
