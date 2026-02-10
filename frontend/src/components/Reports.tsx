import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Calendar,
    BarChart3,
    Building2,
    CheckCircle2,
    Clock,
    TrendingUp
} from 'lucide-react';
import api from '../api/api';
import type { Booking, Invoice } from '../types';

type RangeKey = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'ALL_TIME';

const rangeOptions: { key: RangeKey; label: string }[] = [
    { key: 'LAST_7_DAYS', label: 'Last 7 days' },
    { key: 'LAST_30_DAYS', label: 'Last 30 days' },
    { key: 'THIS_MONTH', label: 'This month' },
    { key: 'ALL_TIME', label: 'All time' },
];

const getRangeStart = (key: RangeKey) => {
    const now = new Date();
    if (key === 'ALL_TIME') return null;

    const d = new Date(now);
    switch (key) {
        case 'LAST_7_DAYS':
            d.setDate(d.getDate() - 7);
            return d;
        case 'LAST_30_DAYS':
            d.setDate(d.getDate() - 30);
            return d;
        case 'THIS_MONTH':
            return new Date(d.getFullYear(), d.getMonth(), 1);
        default:
            return null;
    }
};

const Reports = () => {
    const [range, setRange] = useState<RangeKey>('LAST_30_DAYS');

    const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
        queryKey: ['bookings', 'reports'],
        queryFn: async () => {
            const { data } = await api.get('/bookings');
            return data;
        },
    });

    const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
        queryKey: ['invoices', 'reports'],
        queryFn: async () => {
            const { data } = await api.get('/invoices');
            return data;
        },
    });

    const isLoading = bookingsLoading || invoicesLoading;

    const rangeStart = getRangeStart(range);

    const safeBookings = Array.isArray(bookings) ? bookings : [];
    const safeInvoices = Array.isArray(invoices) ? invoices : [];

    const inRangeBookings = rangeStart
        ? safeBookings.filter(b => b && b.scheduledAt && new Date(b.scheduledAt) >= rangeStart)
        : safeBookings;

    const inRangeInvoices = rangeStart
        ? safeInvoices.filter(i => i && i.issuedAt && new Date(i.issuedAt) >= rangeStart)
        : safeInvoices;

    const totalBookings = inRangeBookings.length;
    const completedBookings = inRangeBookings.filter(b => b && b.status === 'COMPLETED').length;
    const completionRate = totalBookings === 0 ? 0 : Math.round((completedBookings / totalBookings) * 100);

    const collectedRevenue = inRangeInvoices
        .filter(i => i && i.paymentStatus === 'PAID')
        .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const outstandingRevenue = inRangeInvoices
        .filter(i => i && i.paymentStatus !== 'PAID')
        .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const branchSummary = inRangeBookings.reduce<Record<string, { name: string; total: number; completed: number }>>(
        (acc, booking) => {
            if (!booking) return acc;
            const key = booking.branch?.id ?? booking.branchId ?? 'unassigned';
            const name = booking.branch?.name ?? 'Unassigned';
            if (!acc[key]) {
                acc[key] = { name, total: 0, completed: 0 };
            }
            acc[key].total += 1;
            if (booking.status === 'COMPLETED') acc[key].completed += 1;
            return acc;
        },
        {}
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-blue-600" />
                        Branch Reports
                    </h2>
                    <p className="text-slate-500 mt-1">
                        Performance overview for bookings and revenue by branch.
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
                    {rangeOptions.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setRange(opt.key)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${range === opt.key
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="p-10 text-center text-slate-400 animate-pulse flex flex-col items-center gap-3">
                    <Clock className="w-8 h-8 text-blue-500" />
                    Loading reports...
                </div>
            ) : (
                <>
                    {/* Top KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <Calendar className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total Jobs</p>
                                <h4 className="text-2xl font-bold text-slate-900 font-mono">
                                    {totalBookings}
                                </h4>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 rounded-xl">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Completion Rate</p>
                                <h4 className="text-2xl font-bold text-slate-900 font-mono">
                                    {completionRate}%
                                </h4>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <TrendingUp className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Collected Revenue</p>
                                <h4 className="text-2xl font-bold text-slate-900 font-mono">
                                    ₱{collectedRevenue.toLocaleString()}
                                </h4>
                            </div>
                        </div>
                    </div>

                    {/* Revenue split */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-emerald-500" />
                                Revenue Summary
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">Collected</span>
                                    <span className="font-mono font-semibold text-emerald-700">
                                        ₱{collectedRevenue.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">Outstanding</span>
                                    <span className="font-mono font-semibold text-amber-700">
                                        ₱{outstandingRevenue.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                                    <span className="text-xs uppercase text-slate-400 font-bold tracking-widest">
                                        Total Billed
                                    </span>
                                    <span className="font-mono font-bold text-slate-900">
                                        ₱{(collectedRevenue + outstandingRevenue).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-blue-500" />
                                Branch Performance
                            </h3>
                            {Object.keys(branchSummary).length === 0 ? (
                                <p className="text-sm text-slate-400">No bookings in this period.</p>
                            ) : (
                                <div className="space-y-3">
                                    {Object.values(branchSummary).map(branch => {
                                        const rate =
                                            branch.total === 0
                                                ? 0
                                                : Math.round((branch.completed / branch.total) * 100);
                                        return (
                                            <div
                                                key={branch.name}
                                                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                                            >
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">
                                                        {branch.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {branch.completed}/{branch.total} completed
                                                    </p>
                                                </div>
                                                <span className="text-xs font-mono font-semibold text-blue-600">
                                                    {rate}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Reports;

