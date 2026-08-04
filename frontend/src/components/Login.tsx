import React, { useState } from 'react';
import { LogIn, Loader2, Globe, Shield, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import api from '../api/api';
import type { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@arctic.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLoginSuccess(data.user);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "Login failed. Check your credentials.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-pattern-dots opacity-10" />

      <div className="relative max-w-md w-full">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-emerald-500/5 rounded-2xl blur-md" />

        <div className="relative bg-white rounded-2xl shadow-2xl shadow-raised border border-slate-200 overflow-hidden animate-in slide-in-bottom-2 duration-1000">
          {/* Top Gradient Header */}
          <div className="h-32 bg-gradient-to-r from-blue-600 to-emerald-600 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent bottom-0 h-20" />
            <div className="relative flex flex-col items-center">
              <Globe className="w-16 h-16 text-white mb-4 animate-pulse" />
              <h1 className="text-3xl font-black text-white tracking-tight mb-2">Arctic</h1>
              <p className="text-white/90 text-sm font-medium">Service Manager</p>
            </div>
          </div>

          {/* Login Form */}
          <div className="p-8 space-y-6">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2 animate-in fade-in duration-300">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Field */}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 placeholder:text-slate-400"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your email"
                  disabled={loading}
                  type="email"
                  required
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  @branch.com
                </div>
              </div>

              {/* Password Field */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 placeholder:text-slate-400"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  disabled={loading}
                  type={showPassword ? 'text' : 'password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-200 transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* Footer Info */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-center text-slate-400 text-xs font-medium">
                Secure access for authorized personnel only.
              </p>
              <div className="mt-2 flex items-center justify-center gap-2 text-slate-400 text-xs">
                <Globe className="w-3 h-3" />
                <span>Multi-branch support</span>
                <Shield className="w-3 h-3" />
                <span>Enterprise security</span>
              </div>
            </div>
          </div>

          {/* Bottom Decoration */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-100/20 to-transparent" />
        </div>
      </div>
    </div>
  );
};

export default Login;