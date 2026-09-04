import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getList, formatCurrency } from '../api/api';
import { Booking, BookingStatus, Invoice, STATUS_LABELS } from '../types';
import { Card, EmptyState, ErrorState, PageHeader, Spinner, cn } from './ui';

/**
 * REPORTS
 *
 * Everything here is computed client-side from the bookings and invoices the
 * API already returns — no dedicated reporting endpoint, and no PDF/canvas
 * export (the old build pulled in jspdf + html2canvas and never used them).
 */

const RANGES = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 0, label: 'All time' },
] as const;

const Reports: React.FC = () => {
    const [days, setDays] = useState<number>(30);

    const bookingsQuery = useQuery({
        queryKey: ['bookings', 'reports'],
        queryFn: () => getList<Booking>('/bookings', { limit: 500 }),
    });

    const invoicesQuery = useQuery({
        queryKey: ['invoices', 'reports'],
        queryFn: () => getList<Invoice>('/invoices', { limit: 500 }),
    });

    const report = useMemo(() => {
        const bookings = bookingsQuery.data ?? [];
        const invoices = invoicesQuery.data ?? [];

        const cutoff = days > 0 ? Date.now() - days * 86_400_000 : 0;
        const inRange = bookings.filter((b) => +new Date(b.scheduledAt) >= cutoff);
        const invoicesInRange = invoices.filter((i) => +new Date(i.issuedAt) >= cutoff);

        const byStatus = inRange.reduce<Record<string, number>>((acc, b) => {
            acc[b.status] = (acc[b.status] ?? 0) + 1;
            return acc;
        }, {});

        const byService = inRange.reduce<Record<string, number>>((acc, b) => {
            acc[b.serviceType] = (acc[b.serviceType] ?? 0) + 1;
            return acc;
        }, {});

        // Revenue per technician counts only invoices that were actually paid.
        const byTechnician = new Map<string, { name: string; jobs: number; revenue: number }>();
        for (const inv of invoicesInRange) {
            const tech = inv.booking?.technician;
            if (!tech) continue;
            const entry = byTechnician.get(tech.id) ?? { name: tech.name, jobs: 0, revenue: 0 };
            entry.jobs += 1;
            if (inv.paymentStatus === 'PAID') entry.revenue += Number(inv.amount);
            byTechnician.set(tech.id, entry);
        }

        const collected = invoicesInRange
            .filter((i) => i.paymentStatus === 'PAID')
            .reduce((s, i) => s + Number(i.amount), 0);
        const invoiced = invoicesInRange.reduce((s, i) => s + Number(i.amount), 0);
        const completed = byStatus.COMPLETED ?? 0;

        return {
            totalJobs: inRange.length,
            completed,
            completionRate: inRange.length ? Math.round((completed / inRange.length) * 100) : 0,
            collected,
            invoiced,
            collectionRate: invoiced ? Math.round((collected / invoiced) * 100) : 0,
            avgTicket: invoicesInRange.length ? invoiced / invoicesInRange.length : 0,
            byStatus,
            byService: Object.entries(byService).sort((a, b) => b[1] - a[1]),
            technicians: [...byTechnician.values()].sort((a, b) => b.revenue - a.revenue),
        };
    }, [bookingsQuery.data, invoicesQuery.data, days]);

    if (bookingsQuery.isLoading) return <Spinner label="Building report…" />;
    if (bookingsQuery.isError) {
        return <ErrorState error={bookingsQuery.error} onRetry={() => bookingsQuery.refetch()} />;
    }

    const headline = [
        { label: 'Jobs', value: String(report.totalJobs) },
        { label: 'Completed', value: `${report.completed} (${report.completionRate}%)` },
        { label: 'Collected', value: formatCurrency(report.collected) },
        { label: 'Avg. ticket', value: formatCurrency(report.avgTicket) },
    ];

    return (
        <div>
            <PageHeader title="Reports" subtitle="Performance at a glance" />

            <div className="flex gap-1.5 mb-5 overflow-x-auto pb-0.5">
                {RANGES.map((r) => (
                    <button
                        key={r.value}
                        onClick={() => setDays(r.value)}
                        className={cn(
                            'px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition',
                            days === r.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        )}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {headline.map((s) => (
                    <Card key={s.label} className="p-4">
                        <p className="text-xs font-medium text-slate-500">{s.label}</p>
                        <p className="mt-1 text-lg font-bold text-slate-800 truncate">{s.value}</p>
                    </Card>
                ))}
            </div>

            {report.totalJobs === 0 ? (
                <Card className="mt-5">
                    <EmptyState
                        title="Nothing to report yet"
                        message="Once jobs are scheduled in this period, the breakdown appears here."
                    />
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                    <Card>
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="text-sm font-bold text-slate-800">Job status</h2>
                        </div>
                        <div className="p-5 space-y-3">
                            {(Object.keys(STATUS_LABELS) as BookingStatus[]).map((status) => {
                                const count = report.byStatus[status] ?? 0;
                                const pct = report.totalJobs
                                    ? Math.round((count / report.totalJobs) * 100)
                                    : 0;
                                return (
                                    <div key={status}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-600 font-medium">
                                                {STATUS_LABELS[status]}
                                            </span>
                                            <span className="text-slate-400">
                                                {count} · {pct}%
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    <Card>
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="text-sm font-bold text-slate-800">Services</h2>
                        </div>
                        <div className="p-5 space-y-3">
                            {report.byService.map(([service, count]) => {
                                const pct = Math.round((count / report.totalJobs) * 100);
                                return (
                                    <div key={service}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-600 font-medium">
                                                {service}
                                            </span>
                                            <span className="text-slate-400">
                                                {count} · {pct}%
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-violet-500 rounded-full transition-all"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    <Card className="lg:col-span-2">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h2 className="text-sm font-bold text-slate-800">Technicians</h2>
                            <span className="text-xs text-slate-400">
                                {report.collectionRate}% of invoiced amount collected
                            </span>
                        </div>
                        {report.technicians.length === 0 ? (
                            <EmptyState
                                title="No billed jobs yet"
                                message="Technician revenue appears once their jobs are invoiced."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-left">
                                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                Technician
                                            </th>
                                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                Billed jobs
                                            </th>
                                            <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                Collected
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {report.technicians.map((t) => (
                                            <tr key={t.name} className="hover:bg-slate-50/70">
                                                <td className="px-5 py-3 font-semibold text-slate-800">
                                                    {t.name}
                                                </td>
                                                <td className="px-5 py-3 text-slate-600">
                                                    {t.jobs}
                                                </td>
                                                <td className="px-5 py-3 font-semibold text-slate-800">
                                                    {formatCurrency(t.revenue)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Reports;
