import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, CreditCard, Receipt } from 'lucide-react';
import api from '../api/api';
import { Booking } from '../types';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: Booking;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, booking }) => {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState('CASH');

    const mutation = useMutation({
        mutationFn: (data: any) => api.post('/invoices', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            onClose();
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || "Failed to generate invoice");
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            bookingId: booking.id,
            amount: Number(amount),
            paymentMethod
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-blue-600" />
                        <h3 className="text-xl font-bold text-slate-800">Generate Invoice</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl space-y-1">
                        <p className="text-xs font-bold text-slate-400 uppercase">Service Details</p>
                        <p className="text-sm font-semibold text-slate-700">{booking.serviceType}</p>
                        <p className="text-xs text-slate-500">Customer: {booking.customer?.name}</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Total Amount (USD)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                                value={amount}
                                onChange={e => setAmount(Number(e.target.value))}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Payment Method</label>
                        <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value)}
                        >
                            <option value="CASH">Cash</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="E_WALLET">E-Wallet (GCash/Maya)</option>
                            <option value="CHEQUE">Cheque</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5" /> Finalize & Bill</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default InvoiceModal;
