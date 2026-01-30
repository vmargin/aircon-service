import { useState } from 'react';
import { Calendar, MapPin, Phone, User, CheckCircle2 } from 'lucide-react';
import api from '../api/api';
import type { PublicBranch } from '../types';

const PublicBooking = () => {
    const [branches, setBranches] = useState<PublicBranch[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        customerName: '',
        phone: '',
        address: '',
        serviceType: '',
        scheduledAt: '',
        branchId: '',
    });

    useState(() => {
        const fetchBranches = async () => {
            try {
                const { data } = await api.get<PublicBranch[]>('/public/branches');
                setBranches(data);
            } catch {
                setError('Failed to load branches. Please try again later.');
            } finally {
                setLoadingBranches(false);
            }
        };
        fetchBranches();
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            await api.post('/public/bookings', form);
            setSubmitted(true);
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Failed to submit booking.';
            setError(msg);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        Booking Received
                    </h1>
                    <p className="text-slate-500 text-sm mb-4">
                        Our team will review your request and confirm your schedule via the
                        contact details you provided.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">
                    Book Aircon Service
                </h1>
                <p className="text-slate-500 text-sm mb-6">
                    Fill in your details and preferred schedule. A branch will confirm your
                    booking.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-600 rounded-lg">
                        {error}
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            Full name
                        </label>
                        <input
                            required
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            value={form.customerName}
                            onChange={(e) =>
                                setForm((v) => ({ ...v, customerName: e.target.value }))
                            }
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            Mobile number
                        </label>
                        <input
                            required
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            value={form.phone}
                            onChange={(e) =>
                                setForm((v) => ({ ...v, phone: e.target.value }))
                            }
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            Address
                        </label>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            rows={2}
                            value={form.address}
                            onChange={(e) =>
                                setForm((v) => ({ ...v, address: e.target.value }))
                            }
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">
                            Service needed
                        </label>
                        <input
                            required
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            placeholder="Cleaning, repair, installation..."
                            value={form.serviceType}
                            onChange={(e) =>
                                setForm((v) => ({ ...v, serviceType: e.target.value }))
                            }
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                Preferred date & time
                            </label>
                            <input
                                required
                                type="datetime-local"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                value={form.scheduledAt}
                                onChange={(e) =>
                                    setForm((v) => ({ ...v, scheduledAt: e.target.value }))
                                }
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700">
                                Preferred branch
                            </label>
                            {loadingBranches ? (
                                <div className="text-xs text-slate-400 py-2">
                                    Loading branches...
                                </div>
                            ) : (
                                <select
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                    value={form.branchId}
                                    onChange={(e) =>
                                        setForm((v) => ({ ...v, branchId: e.target.value }))
                                    }
                                >
                                    <option value="">Select branch</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.organizationName} – {b.name}
                                            {b.location ? ` (${b.location})` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg"
                    >
                        Submit booking request
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PublicBooking;

