import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronRight,
    Users,
    Building2,
    RefreshCcw
} from 'lucide-react';
import api from '../api/api';
import { Booking, BookingStatus } from '../types';
import BookingModal from './BookingModal';
import InvoiceModal from './InvoiceModal';
import AssignTechnicianModal from './AssignTechnicianModal';

/**
 * DASHBOARD COMPONENT (Pivoted to Bookings)
 * 
 * Uses TanStack Query for state management.
 */
const Dashboard = () => {
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState<BookingStatus | 'ALL'>('ALL');
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [activeBookingForInvoice, setActiveBookingForInvoice] = useState<Booking | null>(null);
    const [activeBookingForAssign, setActiveBookingForAssign] = useState<Booking | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [dispatchOnly, setDispatchOnly] = useState(false);

    // FETCH BOOKINGS (TanStack Query)
    const { data: bookings = [], isLoading, isError, refetch } = useQuery<Booking[]>({
        queryKey: ['bookings'],
        queryFn: async () => {
            const { data } = await api.get('/bookings');
            return data;
        },
    });

    // UPDATE STATUS (Mutation)
    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
            api.patch(`/bookings/${id}`, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
        },
        onError: (err: any) => {
            const msg = err.response?.data?.error || "Failed to update status";
            alert(msg);
        }
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <RefreshCcw className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-slate-400 font-medium animate-pulse">Orbiting data centers...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-red-800">Connection Failed</h3>
                <p className="text-red-600 mb-4">Could not sync with the service engine.</p>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    Retry Sync
                </button>
            </div>
        );
    }

    // STATISTICS CALCULATION
    const safeBookings = Array.isArray(bookings) ? bookings : [];
    const stats = [
        { name: 'Active Bookings', value: safeBookings.filter(b => b && b.status !== 'COMPLETED' && b.status !== 'CANCELLED').length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
        { name: 'Pending Dispatch', value: safeBookings.filter(b => b && !b.technicianId && b.status !== 'CANCELLED').length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
        { name: 'Completed Total', value: safeBookings.filter(b => b && b.status === 'COMPLETED').length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    const statusColors: Record<BookingStatus, string> = {
        PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
        CONFIRMED: 'bg-blue-100 text-blue-700 border-blue-200',
        ON_SITE: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
    };


    const filteredBookings = safeBookings.filter(b => {
        if (!b) return false;
        if (dispatchOnly) return !b.technicianId && b.status !== 'CANCELLED';
        if (filterStatus === 'ALL') return true;
        return b.status === filterStatus;
    });

    return (
        <div className="animate-in fade-in duration-700">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Service Dashboard</h2>
                    <p className="text-slate-500 mt-1">Real-time booking and technician dispatch tracker.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setDispatchOnly(!dispatchOnly)}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-tighter rounded-xl border transition-all ${dispatchOnly ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                    >
                        <AlertCircle className="w-4 h-4" />
                        {dispatchOnly ? 'Showing Unassigned' : 'Dispatch List'}
                    </button>
                    <button
                        onClick={() => { setSelectedBooking(null); setIsBookingModalOpen(true); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        New Booking
                    </button>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {stats.map((stat) => (
                    <div
                        key={stat.name}
                        onClick={() => { if (stat.name === 'Pending Dispatch') setDispatchOnly(true); else setDispatchOnly(false); }}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer"
                    >
                        <div className={`p-3 rounded-xl ${stat.bg}`}>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                            <h4 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h4>
                        </div>
                    </div>
                ))}
            </div>

            {/* FILTERS */}
            {!dispatchOnly && (
                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    {['ALL', ...Object.keys(statusColors)].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status as any)}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${filterStatus === status
                                ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200'
                                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                        >
                            {status.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            )}

            {/* BOOKINGS TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customer & Service</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Technician / Branch</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Schedule</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <Calendar className="w-12 h-12" />
                                            <p className="text-slate-600 font-medium">No bookings found {dispatchOnly ? 'matching dispatch criteria' : 'in this branch'}.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBookings.map((booking) => (
                                    <tr key={booking.id} className="group hover:bg-blue-50/30 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800">{booking.customer?.name || 'Walk-in'}</span>
                                                <span className="text-xs text-slate-400 mt-0.5">{booking.serviceType}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <select
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border leading-none outline-none cursor-pointer ${statusColors[booking.status]}`}
                                                value={booking.status}
                                                onChange={(e) => {
                                                    const newStatus = e.target.value as BookingStatus;
                                                    if (newStatus === 'COMPLETED' && !booking.invoice) {
                                                        setActiveBookingForInvoice(booking);
                                                        setIsInvoiceModalOpen(true);
                                                    } else {
                                                        statusMutation.mutate({ id: booking.id, status: newStatus });
                                                    }
                                                }}
                                            >
                                                {Object.keys(statusColors).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                                    <Users className="w-3 h-3 text-slate-300" />
                                                    {booking.technician?.name || 'Unassigned'}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                                    <Building2 className="w-3 h-3 text-slate-300" />
                                                    {booking.branch?.name || 'Main Office'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Calendar className="w-4 h-4 text-slate-300" />
                                                {new Date(booking.scheduledAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {!booking.technicianId && booking.status !== 'CANCELLED' && (
                                                    <button
                                                        onClick={() => { setActiveBookingForAssign(booking); setIsAssignModalOpen(true); }}
                                                        className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors"
                                                    >
                                                        ASSIGN TECH
                                                    </button>
                                                )}
                                                {!booking.invoice && (
                                                    <button
                                                        onClick={() => { setActiveBookingForInvoice(booking); setIsInvoiceModalOpen(true); }}
                                                        className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                                    >
                                                        BILL NOW
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setSelectedBooking(booking); setIsBookingModalOpen(true); }}
                                                    className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-slate-400 text-xs px-2">
                <p>Total {safeBookings.length} jobs synced</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Live Connection
                </div>
            </div>

            {/* MODALS */}
            <BookingModal
                isOpen={isBookingModalOpen}
                onClose={() => { setIsBookingModalOpen(false); setSelectedBooking(null); }}
                booking={selectedBooking}
            />
            {activeBookingForInvoice && (
                <InvoiceModal
                    isOpen={isInvoiceModalOpen}
                    onClose={() => { setIsInvoiceModalOpen(false); setActiveBookingForInvoice(null); }}
                    booking={activeBookingForInvoice}
                />
            )}
            <AssignTechnicianModal
                isOpen={isAssignModalOpen}
                onClose={() => { setIsAssignModalOpen(false); setActiveBookingForAssign(null); }}
                booking={activeBookingForAssign}
            />
        </div>
    );
};

export default Dashboard;
