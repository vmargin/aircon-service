import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Loader2, Save, Phone, User, Building2 } from 'lucide-react';
import api from '../api/api';
import { Technician, Branch, User as UserType } from '../types';

interface TechnicianModalProps {
    isOpen: boolean;
    onClose: () => void;
    technician?: Technician | null;
}

const TechnicianModal: React.FC<TechnicianModalProps> = ({ isOpen, onClose, technician }) => {
    const queryClient = useQueryClient();
    const currentUser: UserType | null = (() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    })();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [branchId, setBranchId] = useState('');
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        if (technician) {
            setName(technician.name);
            setPhone(technician.phone || '');
            setBranchId(technician.branchId);
            setIsActive(technician.isActive);
        } else {
            setName('');
            setPhone('');
            setBranchId(currentUser?.role === 'BRANCH_LEADER' ? currentUser.branchId || '' : '');
            setIsActive(true);
        }
    }, [technician, isOpen, currentUser]);

    const { data: branches = [] } = useQuery<Branch[]>({
        queryKey: ['branches'],
        queryFn: async () => (await api.get('/branches')).data
    });

    const mutation = useMutation({
        mutationFn: (data: any) => technician
            ? api.patch(`/technicians/${technician.id}`, data)
            : api.post('/technicians', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['technicians'] });
            onClose();
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || "Failed to save technician");
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            name,
            phone,
            branchId,
            isActive
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-800">{technician ? 'Edit Technician' : 'Add New Technician'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" />
                            <input
                                required
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Technician Name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Phone Number</label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" />
                            <input
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="09XX XXX XXXX"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Branch Assignment</label>
                        <div className="relative">
                            <Building2 className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" />
                            <select
                                required
                                disabled={currentUser?.role === 'BRANCH_LEADER'}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                value={branchId}
                                onChange={e => setBranchId(e.target.value)}
                            >
                                <option value="">Select Branch</option>
                                {(Array.isArray(branches) ? branches : []).map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {technician && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={isActive}
                                onChange={e => setIsActive(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="isActive" className="text-sm font-bold text-slate-700">Active / Available for Dispatch</label>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 mt-2"
                    >
                        {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> {technician ? 'Update Records' : 'Save Technician'}</>}
                    </button>

                    {technician && (
                        <p className="text-[10px] text-slate-400 text-center italic mt-2">
                            * Deactivating will prevent new bookings but preserve history for old jobs.
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
};

export default TechnicianModal;
