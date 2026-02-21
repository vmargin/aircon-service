import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Loader2, Save, User, Building2, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import api from '../api/api';
import { Booking, Technician } from '../types';

interface AssignTechnicianModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: Booking | null;
}

const AssignTechnicianModal: React.FC<AssignTechnicianModalProps> = ({ isOpen, onClose, booking }) => {
    const queryClient = useQueryClient();
    const currentUser = (() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    })();

    const [technicianId, setTechnicianId] = useState('');

    useEffect(() => {
        if (booking) {
            setTechnicianId(booking.technicianId || '');
        }
    }, [booking, isOpen]);

    // Query for ALL active technicians
    const { data: technicians = [], isLoading, refetch, isFetching } = useQuery<Technician[]>({
        queryKey: ['technicians', 'active'],
        queryFn: async () => {
            const { data } = await api.get('/technicians?includeInactive=false');
            return data;
        },
        enabled: isOpen,
    });

    const mutation = useMutation({
        mutationFn: (data: { technicianId: string | null }) =>
            api.patch(`/bookings/${booking?.id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            onClose();
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || "Failed to assign technician");
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({ technicianId: technicianId || null });
    };

    if (!isOpen || !booking) return null;

    const allTechs = Array.isArray(technicians) ? technicians : [];

    // Sort so branch-specific techs are at the top
    const sortedTechnicians = [...allTechs].sort((a, b) => {
        const aMatch = a.branchId === booking.branchId ? 0 : 1;
        const bMatch = b.branchId === booking.branchId ? 0 : 1;
        return aMatch - bMatch;
    });

    // RBAC Filter
    const filteredTechnicians = sortedTechnicians.filter(t =>
        currentUser?.role === 'ADMIN' || t.branchId === currentUser?.branchId
    );

    const isBranchMismatch = currentUser?.role === 'BRANCH_LEADER' && currentUser?.branchId !== booking.branchId;
    const hasVisibleTechs = filteredTechnicians.length > 0;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800">Assign Technician</h3>
                        <p className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]">
                            Job for {booking.customer?.name || 'Customer'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-700 mb-1">
                            <Building2 className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-tight">Booking Branch</span>
                        </div>
                        <p className="text-sm font-semibold text-blue-900">{booking.branch?.name || 'Generic Branch'}</p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Choose Technician</label>
                            <button
                                type="button"
                                onClick={() => refetch()}
                                className="text-blue-500 hover:text-blue-700 p-1"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="relative">
                            <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" />
                            <select
                                required
                                disabled={isBranchMismatch && !hasVisibleTechs}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-bold text-slate-700 transition-all disabled:opacity-50"
                                value={technicianId}
                                onChange={e => setTechnicianId(e.target.value)}
                            >
                                <option value="">-- Select Technician --</option>
                                {filteredTechnicians.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} {t.branchId === booking.branchId ? '⭐ (Local)' : `(${t.branch?.name || 'Other'})`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {isBranchMismatch && (
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-[10px] text-amber-800 leading-tight">
                                        <b>Branch Mismatch:</b> This job belongs to <b>{booking.branch?.name}</b>, but you are assigned to <b>{currentUser?.branchName || 'another branch'}</b>. You can only assign technicians to jobs at your branch.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => { localStorage.removeItem('user'); window.location.reload(); }}
                                        className="flex items-center gap-1 text-[9px] font-black text-amber-700 uppercase"
                                    >
                                        <LogOut className="w-3 h-3" /> Re-login to Refresh
                                    </button>
                                </div>
                            </div>
                        )}

                        {!hasVisibleTechs && !isLoading && (
                            <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                                <p className="text-xs text-rose-800 font-medium">
                                    No authorized technicians found for your branch.
                                </p>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={mutation.isPending || !hasVisibleTechs}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 mt-2"
                    >
                        {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Assignment"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AssignTechnicianModal;
