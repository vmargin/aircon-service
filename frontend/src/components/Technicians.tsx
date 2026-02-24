import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Users,
    Phone,
    Plus,
    Building2,
    ChevronRight,
    UserPlus,
    Shield,
    ShieldAlert,
    Filter
} from 'lucide-react';
import api from '../api/api';
import { Technician, User as UserType } from '../types';
import TechnicianModal from './TechnicianModal';

interface Props {
    showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const Technicians: React.FC<Props> = ({ showNotification }) => {
    const [selectedTech, setSelectedTech] = useState<Technician | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showInactive, setShowInactive] = useState(false);

    const currentUser: UserType | null = (() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    })();

    const { data: technicians = [], isLoading, refetch } = useQuery<Technician[]>({
        queryKey: ['technicians', showInactive],
        queryFn: async () => {
            const { data } = await api.get(`/technicians?includeInactive=${showInactive}`);
            return data;
        },
    });

    const safeTechnicians = Array.isArray(technicians) ? technicians : [];

    if (isLoading) return <div className="p-10 text-center animate-pulse">Scanning technician dispatch...</div>;

    return (
        <div className="animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Technical Personnel</h2>
                    <p className="text-slate-500 mt-1">Manage service staff and branch assignments.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowInactive(!showInactive)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-tight transition-all ${showInactive ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                    >
                        <Filter className="w-4 h-4" />
                        {showInactive ? 'Showing All' : 'Active Only'}
                    </button>

                    <button
                        onClick={() => { setSelectedTech(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                        <UserPlus className="w-5 h-5" />
                        New Technician
                    </button>
                </div>
            </div>

            {/* LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {safeTechnicians.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                        <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400">No technical staff found{showInactive ? '' : ' matching active criteria'}.</p>
                    </div>
                ) : (
                    safeTechnicians.map((tech) => (
                        <div
                            key={tech.id}
                            onClick={() => { setSelectedTech(tech); setIsModalOpen(true); }}
                            className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden ${!tech.isActive ? 'opacity-70 grayscale-[0.5]' : ''}`}
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-5 h-5 text-blue-500" />
                            </div>

                            <div className="flex items-center gap-4 mb-5">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${tech.isActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {tech.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-slate-900 truncate">{tech.name}</h4>
                                        {tech.isActive ? (
                                            <Shield className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">
                                        {tech.isActive ? 'Active Personnel' : 'Deactivated'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                                    <Phone className="w-4 h-4 text-slate-300" />
                                    <span className="font-medium">{tech.phone || 'No phone recorded'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50/50 p-2 rounded-lg">
                                    <Building2 className="w-4 h-4 text-blue-300" />
                                    <span className="font-semibold text-blue-700">{tech.branch?.name || 'Assigned Branch'}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <TechnicianModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedTech(null); }}
                technician={selectedTech}
            />
        </div>
    );
};

export default Technicians;
