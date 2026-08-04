import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Loader2, Save, Calendar, User, MapPin, Wrench, Search, Plus } from 'lucide-react';
import api, { getList } from '../api/api';
import { Booking, Branch, Customer, Technician, User as UserType } from '../types';

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking?: Booking | null;
}

const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, booking }) => {
    const queryClient = useQueryClient();
    const currentUser: UserType | null = (() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    })();

    // Form State
    const [serviceType, setServiceType] = useState(booking?.serviceType || '');
    const [scheduledAt, setScheduledAt] = useState(booking?.scheduledAt?.split('T')[0] || '');
    const [customerId, setCustomerId] = useState(booking?.customerId || '');
    const [branchId, setBranchId] = useState(booking?.branchId || (currentUser?.role === 'BRANCH_LEADER' ? currentUser.branchId || '' : ''));
    const [technicianId, setTechnicianId] = useState(booking?.technicianId || '');

    // Search and New Customer State
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });

    // Fetch Options
    const { data: customers = [] } = useQuery<Customer[]>({
        queryKey: ['customers'],
        queryFn: () => getList<Customer>('/customers', { limit: 200 }),
    });
    const { data: branches = [] } = useQuery<Branch[]>({
        queryKey: ['branches'],
        queryFn: () => getList<Branch>('/branches'),
    });
    const { data: technicians = [] } = useQuery<Technician[]>({
        queryKey: ['technicians'],
        queryFn: () => getList<Technician>('/technicians'),
    });

    // Filtered Customers
    const filteredCustomers = (Array.isArray(customers) ? customers : []).filter(c =>
        c && (c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm))
    );

    const createCustomerMutation = useMutation({
        mutationFn: (data: typeof newCustomer) => api.post('/customers', data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            setCustomerId(res.data.id);
            setIsCreatingCustomer(false);
            setSearchTerm(res.data.name);
        }
    });

    const bookingMutation = useMutation({
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
        bookingMutation.mutate({
            serviceType,
            scheduledAt: new Date(scheduledAt).toISOString(),
            customerId,
            branchId,
            technicianId: technicianId || undefined
        });
    };

    if (!isOpen) return null;

    const selectedCustomer = (Array.isArray(customers) ? customers : []).find(c => c && c.id === customerId);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-800">{booking ? 'Edit Booking' : 'New Service Booking'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
                    {/* CUSTOMER DISCOVERY */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Customer Discovery</label>

                        {!customerId && !isCreatingCustomer && (
                            <div className="relative">
                                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                <input
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Search by name or phone..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && filteredCustomers.length > 0 && (
                                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {filteredCustomers.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => { setCustomerId(c.id); setSearchTerm(c.name); }}
                                                className="w-full px-4 py-3 text-left hover:bg-slate-50 flex flex-col border-b border-slate-50 last:border-0"
                                            >
                                                <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                                                <span className="text-xs text-slate-500">{c.phone}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {searchTerm && filteredCustomers.length === 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingCustomer(true)}
                                        className="w-full mt-2 p-4 border-2 border-dashed border-slate-200 rounded-xl text-blue-600 font-bold text-sm hover:border-blue-200 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> No results. Create "{searchTerm}"?
                                    </button>
                                )}
                            </div>
                        )}

                        {customerId && (
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-blue-900">{selectedCustomer?.name}</p>
                                    <p className="text-xs text-blue-700">{selectedCustomer?.phone} • {selectedCustomer?.address}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setCustomerId(''); setSearchTerm(''); }}
                                    className="text-xs font-bold text-blue-600 hover:underline"
                                >
                                    Change
                                </button>
                            </div>
                        )}

                        {isCreatingCustomer && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm font-bold text-slate-700">New Customer Record</p>
                                    <button type="button" onClick={() => setIsCreatingCustomer(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                </div>
                                <input
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                    placeholder="Full Name"
                                    value={newCustomer.name}
                                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                />
                                <input
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                    placeholder="Phone Number"
                                    value={newCustomer.phone}
                                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                />
                                <input
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                    placeholder="Full Address"
                                    value={newCustomer.address}
                                    onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                />
                                <button
                                    type="button"
                                    disabled={createCustomerMutation.isPending || !newCustomer.name || !newCustomer.phone}
                                    onClick={() => createCustomerMutation.mutate(newCustomer)}
                                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm"
                                >
                                    {createCustomerMutation.isPending ? "Creating..." : "Save Customer"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* BOOKING DETAILS */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Service Type</label>
                            <select
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                value={serviceType}
                                onChange={e => setServiceType(e.target.value)}
                            >
                                <option value="">Select Service</option>
                                <option value="Cleaning">Cleaning</option>
                                <option value="Repair">Repair</option>
                                <option value="Maintenance">Maintenance</option>
                            </select>
                        </div>
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
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Branch</label>
                        <select
                            required
                            disabled={currentUser?.role === 'BRANCH_LEADER'}
                            className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${currentUser?.role === 'BRANCH_LEADER' ? 'opacity-70 grayscale' : ''}`}
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                        >
                            <option value="">Select Branch</option>
                            {(Array.isArray(branches) ? branches : []).map(b => b && <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Assigned Technician</label>
                        <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={technicianId}
                            onChange={e => setTechnicianId(e.target.value)}
                        >
                            <option value="">Assign Later (Default)</option>
                            {(Array.isArray(technicians) ? technicians : []).filter(t => t && t.branchId === branchId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <p className="text-[10px] text-slate-400 ml-1 italic">* You can leave this blank to assign later from the dispatch list.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={bookingMutation.isPending || !customerId}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        {bookingMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Booking</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BookingModal;
