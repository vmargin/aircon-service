import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Users,
    MapPin,
    Phone,
    Plus,
    Search,
    ChevronRight,
    UserPlus
} from 'lucide-react';
import api from '../api/api';
import { Customer } from '../types';

const Customers = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const { data: customers = [], isLoading } = useQuery<Customer[]>({
        queryKey: ['customers'],
        queryFn: async () => {
            const { data } = await api.get('/customers');
            return data;
        },
    });

    const safeCustomers = Array.isArray(customers) ? customers : [];
    const filteredCustomers = safeCustomers.filter(c =>
        c && (c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm))
    );

    if (isLoading) return <div className="p-10 text-center animate-pulse">Syncing client database...</div>;

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Customer Management</h2>
                    <p className="text-slate-500 mt-1">Directory of your service clients.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                            placeholder="Search by name or phone..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200">
                        <UserPlus className="w-5 h-5" />
                        Add Customer
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCustomers.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                        <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400">No customers found.</p>
                    </div>
                ) : (
                    filteredCustomers.map((c) => (
                        <div key={c.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group cursor-pointer relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                                    {c.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900">{c.name}</h4>
                                    <p className="text-xs text-slate-400 uppercase font-black tracking-tighter">Client since 2024</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Phone className="w-4 h-4 text-slate-300" />
                                    {c.phone}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <MapPin className="w-4 h-4 text-slate-300" />
                                    <span className="truncate">{c.address || 'No address provided'}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Customers;
