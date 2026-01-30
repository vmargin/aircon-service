import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Loader2, Save, Calendar, User, MapPin, Wrench } from 'lucide-react';
import api from '../api/api';
import { Booking, Branch, Customer, Technician } from '../types';

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking?: Booking | null;
}

const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, booking }) => {
    const queryClient = useQueryClient();
    const [serviceType, setServiceType] = useState(booking?.serviceType || '');
    const [scheduledAt, setScheduledAt] = useState(booking?.scheduledAt?.split('T')[0] || '');
    const [customerId, setCustomerId] = useState(booking?.customerId || '');
    const [branchId, setBranchId] = useState(booking?.branchId || '');
    const [technicianId, setTechnicianId] = useState(booking?.technicianId || '');

    // Fetch Options
    const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ['customers'], queryFn: async () => (await api.get('/customers')).data });
    const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ['branches'], queryFn: async () => (await api.get('/branches')).data });
    const { data: technicians = [] } = useQuery<Technician[]>({ queryKey: ['technicians'], queryFn: async () => (await api.get('/technicians')).data });

    const mutation = useMutation({
        mutationFn: (data: any) => booking
            ? api.patch(`/bookings/${booking.id}`, data)
            : api.post('/bookings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            onClose();
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || "Failed to save booking");
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            serviceType,
            scheduledAt: new Date(scheduledAt).toISOString(),
            customerId,
            branchId,
            technicianId: technicianId || undefined
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-800">{booking ? 'Edit Booking' : 'New Service Booking'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Service Type</label>
                        <input
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={serviceType}
                            onChange={e => setServiceType(e.target.value)}
                            placeholder="e.g. Chemical Wash, Installation"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Schedule Date</label>
                            <input
                                required
                                type="date"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Branch</label>
                            <select
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                value={branchId}
                                onChange={e => setBranchId(e.target.value)}
                            >
                                <option value="">Select Branch</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Customer</label>
                        <select
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={customerId}
                            onChange={e => setCustomerId(e.target.value)}
                        >
                            <option value="">Select Customer</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Assigned Technician</label>
                        <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={technicianId}
                            onChange={e => setTechnicianId(e.target.value)}
                        >
                            <option value="">Assign Later</option>
                            {technicians.filter(t => t.branchId === branchId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Booking</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BookingModal;
