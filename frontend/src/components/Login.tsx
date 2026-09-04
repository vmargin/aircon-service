import React, { useState } from 'react';
import { Snowflake, Loader2, AlertCircle, Mail, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

/**
 * Login screen. The demo credential hints are shown only when
 * VITE_SHOW_DEMO_CREDENTIALS is set, so a real deployment doesn't advertise
 * its seed accounts on the sign-in page.
 */
const SHOW_DEMO_HINT = import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true';

const Login: React.FC = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await login(email.trim(), password);
            // On success AuthProvider sets `user`, and the router swaps to the
            // app shell — no manual navigation needed.
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                        <Snowflake className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="mt-4 text-2xl font-bold text-slate-800">Arctic Aircon</h1>
                    <p className="text-sm text-slate-500">Service Management</p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4"
                >
                    <div className="space-y-1.5">
                        <label
                            htmlFor="email"
                            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                        >
                            Email
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                            <input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label
                            htmlFor="password"
                            className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                        >
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                            <input
                                id="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                            />
                        </div>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl"
                        >
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-rose-700 font-medium">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
                    </button>
                </form>

                {SHOW_DEMO_HINT && (
                    <div className="mt-4 p-4 bg-white/60 border border-slate-200 rounded-xl">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Demo accounts
                        </p>
                        <ul className="space-y-1 text-xs text-slate-600 font-mono">
                            <li>admin@arctic.com — all branches</li>
                            <li>north@arctic.com — one branch</li>
                        </ul>
                        <p className="mt-2 text-[11px] text-slate-400">
                            Password is whatever you seeded (default <code>demo1234</code>).
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;
