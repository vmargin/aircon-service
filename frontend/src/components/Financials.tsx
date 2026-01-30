import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    DollarSign,
    Receipt,
    CheckCircle2,
    Clock,
    TrendingUp,
    CreditCard,
    Building2,
    Calendar
} from 'lucide-react';
import api from '../api/api';
import { Invoice, PaymentStatus } from '../types';

const Financials = () => {
    const queryClient = useQueryClient();

    const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
        queryKey: ['invoices'],
        queryFn: async () => {
            const { data } = await api.get('/invoices');
            return data;
        },
    });

    const paymentMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: PaymentStatus }) =>
            api.patch(`/invoices/${id}/payment`, { paymentStatus: status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        }
    });

    const totalRevenue = invoices
        .filter(i => i.paymentStatus === 'PAID')
        .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const pendingRevenue = invoices
        .filter(i => i.paymentStatus !== 'PAID')
        .reduce((acc, curr) => acc + Number(curr.amount), 0);

    if (isLoading) return <div className="p-10 text-center animate-pulse">Loading revenue streams...</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-blue-600">Revenue Tracking</h2>
                <p className="text-slate-500 mt-1">Manage invoices and track your branch's financial health.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Collected Revenue</p>
                        <h4 className="text-2xl font-bold text-slate-900 font-mono">${totalRevenue.toLocaleString()}</h4>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-xl">
                        <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Outstanding Invoices</p>
                        <h4 className="text-2xl font-bold text-slate-900 font-mono">${pendingRevenue.toLocaleString()}</h4>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-blue-200 transition-colors group">
                    <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100">
                        <Receipt className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Total Billed</p>
                        <h4 className="text-2xl font-bold text-slate-900 font-mono">${(totalRevenue + pendingRevenue).toLocaleString()}</h4>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-500" />
                        Recent Invoices
                    </h3>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{invoices.length} TOTAL</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Invoice ID / Customer</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Service</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-slate-300 italic">No financial data available.</td>
                                </tr>
                            ) : (
                                invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-mono text-slate-400">#INC-{inv.id.slice(0, 8).toUpperCase()}</span>
                                                <span className="text-sm font-bold text-slate-700">{inv.booking?.customer?.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-sm text-slate-600">{inv.booking?.serviceType}</td>
                                        <td className="px-6 py-5 font-bold text-slate-900">${Number(inv.amount).toFixed(2)}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${inv.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                {inv.paymentStatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {inv.paymentStatus !== 'PAID' && (
                                                <button
                                                    onClick={() => paymentMutation.mutate({ id: inv.id, status: 'PAID' })}
                                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-transform active:scale-95 shadow-sm"
                                                >
                                                    MARK AS PAID
                                                </button>
                                            )}
                                            {inv.paymentStatus === 'PAID' && (
                                                <CheckCircle2 className="w-6 h-6 text-emerald-500 ml-auto" />
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Financials;
