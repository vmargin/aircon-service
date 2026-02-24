import { useState, useEffect } from 'react';
import {
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Users,
  Building2,
  RefreshCcw,
  TrendingUp,
  BarChart3,
  Globe,
  Zap,
  Shield,
  Package,
  UserPlus
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/api';
import { Booking, BookingStatus, User } from '../types';
import BookingModal from './BookingModal';
import InvoiceModal from './InvoiceModal';
import AssignTechnicianModal from './AssignTechnicianModal';
import { StatusBadge } from './components/ui';
import { showNotification } from '../App';

interface DashboardProps {
  showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ showNotification }) => {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<BookingStatus | 'ALL'>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeBookingForInvoice, setActiveBookingForInvoice] = useState<Booking | null>(null);
  const [activeBookingForAssign, setActiveBookingForAssign] = useState<Booking | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [dispatchOnly, setDispatchOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FETCH BOOKINGS (TanStack Query)
  const { data: bookings = [], refetch } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data } = await api.get('/bookings');
      return data;
    },
    onSuccess: () => setIsLoading(false),
    onError: (err: any) => {
      setIsLoading(false);
      setError(err.response?.data?.error || "Failed to load bookings");
    }
  });

  // UPDATE STATUS (Mutation)
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      api.patch(`/bookings/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      showNotification('Booking status updated successfully', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || "Failed to update status";
      showNotification(msg, 'error');
    }
  });

  // Handle completed booking with invoice
  const handleCompletedBooking = (booking: Booking) => {
    if (!booking.invoice) {
      setActiveBookingForInvoice(booking);
      setIsInvoiceModalOpen(true);
    } else {
      statusMutation.mutate({ id: booking.id, status: 'COMPLETED' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <RefreshCcw className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-slate-400 font-medium animate-pulse">Syncing with service engine...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-rose-800">Connection Failed</h3>
        <p className="text-rose-600 mb-4">Could not sync with the service engine.</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => {
              setIsLoading(true);
              setError(null);
              refetch();
            }}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            Retry Sync
          </button>
          <button
            onClick={() => showNotification('Please check your internet connection', 'info')}
            className="px-4 py-2 bg-white text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
          >
            Need Help?
          </button>
        </div>
      </div>
    );
  }

  // STATISTICS CALCULATION
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const stats = [
    {
      name: 'Active Bookings',
      value: safeBookings.filter(b => b && b.status !== 'COMPLETED' && b.status !== 'CANCELLED').length,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      tooltip: 'All bookings that are not completed or cancelled'
    },
    {
      name: 'Pending Dispatch',
      value: safeBookings.filter(b => b && !b.technicianId && b.status !== 'CANCELLED').length,
      icon: AlertCircle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      tooltip: 'Bookings waiting to be assigned to a technician'
    },
    {
      name: 'Completed Today',
      value: safeBookings.filter(b =>
        b &&
        b.status === 'COMPLETED' &&
        new Date(b.updatedAt).toDateString() === new Date().toDateString()
      ).length,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tooltip: 'Bookings completed today'
    },
    {
      name: 'Total Revenue',
      value: safeBookings
        .filter(b => b && b.invoice && b.invoice.paymentStatus === 'PAID')
        .reduce((acc, curr) => acc + Number(curr.invoice?.amount || 0), 0)
        .toLocaleString(),
      icon: TrendingUp,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      tooltip: 'Total revenue from paid invoices'
    },
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
    <div className="animate-in fade-in slide-in-top-2 duration-700">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
            <Globe className="inline w-6 h-6 text-blue-600 mr-2" />
            Service Dashboard
          </h2>
          <p className="text-slate-500 mt-1">Real-time booking and technician dispatch tracker with live updates.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setDispatchOnly(!dispatchOnly)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-tighter rounded-xl border transition-all group hover:shadow-sm ${dispatchOnly
              ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
              : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600'
              }`}
          >
            <AlertCircle className="w-4 h-4" />
            {dispatchOnly ? 'Unassigned Only' : 'All Bookings'}
            <span className="ml-2 px-2 py-0.5 bg-rose-200 text-rose-700 text-[9px] rounded-full">
              {safeBookings.filter(b => b && !b.technicianId && b.status !== 'CANCELLED').length}
            </span>
          </button>
          <button
            onClick={() => { setSelectedBooking(null); setIsBookingModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 hover:shadow-xl hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            New Booking
          </button>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat) => (
          <button
            key={stat.name}
            onClick={() => {
              if (stat.name === 'Pending Dispatch') setDispatchOnly(true);
              else setDispatchOnly(false);
            }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-raised transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                <stat.icon className={`w-6 h-6 ${stat.color} group-hover:scale-110 transition-transform`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                <h4 className="text-2xl font-black text-slate-900 mt-1 group-hover:text-blue-600 transition-colors">
                  {stat.value}
                </h4>
                <p className="text-xs text-slate-400 mt-1 italic">{stat.tooltip}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* FILTERS */}
      {!dispatchOnly && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
          {['ALL', ...Object.keys(statusColors)].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap flex items-center gap-2 group hover:shadow-sm ${filterStatus === status
                ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600'
                }`}
            >
              <StatusBadge status={status as BookingStatus} />
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {/* BOOKINGS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-raised transition-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Customer & Service</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Technician / Branch</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Schedule</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Calendar className="w-16 h-16 text-slate-200" />
                      <p className="text-slate-400 font-medium text-lg">
                        {dispatchOnly ? 'No unassigned bookings' : 'No bookings found'}
                      </p>
                      <p className="text-slate-400 text-sm">
                        {dispatchOnly
                          ? 'All bookings have been assigned to technicians'
                          : 'No bookings match your filter criteria'
                        }
                      </p>
                      {!dispatchOnly && (
                        <button
                          onClick={() => {
                            setFilterStatus('ALL');
                            setDispatchOnly(false);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filteredBookings.length > 0 && filteredBookings.map((booking) => (
                <tr key={booking.id} className="group hover:bg-blue-50/20 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {booking.customer?.name || 'Walk-in'}
                      </span>
                      <span className="text-xs text-slate-400 mt-0.5">{booking.serviceType}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <select
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border leading-none outline-none cursor-pointer ${statusColors[booking.status]}`}
                      value={booking.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as BookingStatus;
                        if (newStatus === 'COMPLETED') {
                          handleCompletedBooking(booking);
                        } else {
                          statusMutation.mutate({ id: booking.id, status: newStatus });
                        }
                      }}
                    >
                      {Object.keys(statusColors).map(s => (
                        <option key={s} value={s} className="text-slate-700">
                          {s.replace('_', ' ')}
                        </option>
                      ))}
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
                      {new Date(booking.scheduledAt).toLocaleDateString() !== new Date(booking.createdAt).toLocaleDateString() && (
                        <span className="text-xs text-slate-400 ml-2">NEW</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!booking.technicianId && booking.status !== 'CANCELLED' && (
                        <button
                          onClick={() => { setActiveBookingForAssign(booking); setIsAssignModalOpen(true); }}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-black rounded-lg border border-rose-100 hover:bg-rose-100 transition-all hover:shadow-sm"
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          ASSIGN
                        </button>
                      )}
                      {!booking.invoice && (
                        <button
                          onClick={() => { setActiveBookingForInvoice(booking); setIsInvoiceModalOpen(true); }}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-all hover:shadow-sm"
                        >
                          <Package className="w-3 h-3 mr-1" />
                          BILL
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedBooking(booking); setIsBookingModalOpen(true); }}
                        className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all group"
                      >
                        <ChevronRight className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* STATUS INFO */}
      <div className="mt-6 flex items-center justify-between text-slate-400 text-xs px-2">
        <p>
          Total {safeBookings.length} jobs synced •
          {safeBookings.filter(b => b && b.status === 'PENDING').length} pending •
          {safeBookings.filter(b => b && b.status === 'COMPLETED').length} completed
        </p>
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