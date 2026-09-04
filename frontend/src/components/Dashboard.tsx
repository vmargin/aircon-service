import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    CalendarClock,
    CheckCircle2,
    Truck,
    Wallet,
    ArrowRight,
    CircleDollarSign,
} from 'lucide-react';

import { getList, formatCurrency, formatDate } from '../api/api';
import { Booking, Invoice } from '../types';
import { useAuth } from '../auth/AuthContext';
import { Card, ErrorState, PageHeader, Spinner, StatusBadge, EmptyState, cn } from './ui';

/**
 * DASHBOARD
 *
 * Counts are derived from the same booking list the table renders, so the two
 * can never disagree. Everything is branch-scoped by the API, so an ADMIN sees
 * org-wide numbers and a BRANCH_LEADER sees only their own.
 */

const StatCard: React.FC<{
    label: string;
    value: string;
    icon: React.ElementType;
    tone: 'blue' | 'amber' | 'violet' | 'emerald';
}> = ({ label, value, icon: Icon, tone }) => {
    const tones = {
        blue: 'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        violet: 'bg-violet-50 text-violet-600',
        emerald: 'bg-emerald-50 text-emerald-600',
    };

    return (
        <Card className="p-4">
            <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', tones[tone])}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
                    <p className="text-xl font-bold text-slate-800">{value}</p>
                </div>
            </div>
        </Card>
    );
};

const Dashboard: React.FC = () => {
    const { user } = useAuth();

    const bookingsQuery = useQuery({
        queryKey: ['bookings', 'dashboard'],
        queryFn: () => getList<Booking>('/bookings', { limit: 100 }),
    });

    const invoicesQuery = useQuery({
        queryKey: ['invoices', 'dashboard'],
        queryFn: () => getList<Invoice>('/invoices', { limit: 200 }),
    });

    if (bookingsQuery.isLoading) return <Spinner label="Loading dashboard…" />;
    if (bookingsQuery.isError) {
        return <ErrorState error={bookingsQuery.error} onRetry={() => bookingsQuery.refetch()} />;
    }

    const bookings = bookingsQuery.data ?? [];
    const invoices = invoicesQuery.data ?? [];

    const active = bookings.filter((b) => b.status === 'PENDING' || b.status === 'CONFIRMED');
    const onSite = bookings.filter((b) => b.status === 'ON_SITE');
    const completed = bookings.filter((b) => b.status === 'COMPLETED');

    // Collected revenue only counts invoices actually marked paid.
    const collected = invoices
        .filter((i) => i.paymentStatus === 'PAID')
        .reduce((sum, i) => sum + Number(i.amount), 0);
    const outstanding = invoices
        .filter((i) => i.paymentStatus !== 'PAID')
        .reduce((sum, i) => sum + Number(i.amount), 0);

    // Nearest upcoming jobs first.
    const upcoming = [...active]
        .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
        .slice(0, 6);

    return (
        <div>
            <PageHeader
                title={`Welcome back`}
                subtitle={
                    user?.role === 'ADMIN'
                        ? `${user.orgName} — all branches`
                        : `${user?.branchName ?? 'Your branch'}`
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                    label="Open jobs"
                    value={String(active.length)}
                    icon={CalendarClock}
                    tone="amber"
                />
                <StatCard label="On site" value={String(onSite.length)} icon={Truck} tone="violet" />
                <StatCard
                    label="Completed"
                    value={String(completed.length)}
                    icon={CheckCircle2}
                    tone="emerald"
                />
                <StatCard
                    label="Collected"
                    value={formatCurrency(collected)}
                    icon={Wallet}
                    tone="blue"
                />
            </div>

            {outstanding > 0 && (
                <Card className="mt-4 p-4 border-amber-200 bg-amber-50/50">
                    <div className="flex items-center gap-3">
                        <CircleDollarSign className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-900">
                            <span className="font-semibold">{formatCurrency(outstanding)}</span>{' '}
                            still uncollected across unpaid invoices.
                        </p>
                        <Link
                            to="/invoices"
                            className="ml-auto text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap"
                        >
                            View →
                        </Link>
                    </div>
                </Card>
            )}

            <Card className="mt-5">
                <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-800">Upcoming jobs</h2>
                    <Link
                        to="/bookings"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                        All bookings <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {upcoming.length === 0 ? (
                    <EmptyState
                        title="No upcoming jobs"
                        message="Newly created bookings will appear here."
                    />
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {upcoming.map((b) => (
                            <li
                                key={b.id}
                                className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50/70 transition"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                        {b.customer?.name ?? 'Unknown customer'}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">
                                        {b.serviceType} · {formatDate(b.scheduledAt, true)}
                                        {b.technician ? ` · ${b.technician.name}` : ' · Unassigned'}
                                    </p>
                                </div>
                                <StatusBadge status={b.status} />
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default Dashboard;
