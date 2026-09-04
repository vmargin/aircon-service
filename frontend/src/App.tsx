import React, { useState } from 'react';
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    NavLink,
    Outlet,
    useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    Snowflake,
    LayoutDashboard,
    CalendarCheck,
    Users,
    Wrench,
    Receipt,
    BarChart3,
    LogOut,
    Menu,
    X,
    Loader2,
} from 'lucide-react';

import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Bookings from './components/Bookings';
import Customers from './components/Customers';
import Technicians from './components/Technicians';
import Financials from './components/Financials';
import Reports from './components/Reports';
import { cn } from './components/ui';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // A 401 is terminal — retrying just burns requests before the
            // interceptor signs the user out.
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
        },
    },
});

const NAV = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/bookings', label: 'Bookings', icon: CalendarCheck },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/technicians', label: 'Technicians', icon: Wrench },
    { to: '/invoices', label: 'Invoices', icon: Receipt },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
] as const;

/** Sidebar content, shared by the desktop rail and the mobile drawer. */
const SidebarContent: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
    const { user, logout } = useAuth();

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                    <Snowflake className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                        {user?.orgName || 'Arctic Aircon'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                        {user?.role === 'ADMIN' ? 'All branches' : user?.branchName || 'Branch'}
                    </p>
                </div>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {NAV.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
                                isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            )
                        }
                    >
                        <Icon className="w-4.5 h-4.5 shrink-0" />
                        {label}
                    </NavLink>
                ))}
            </nav>

            <div className="p-3 border-t border-slate-800">
                <p className="px-3 pb-2 text-[11px] text-slate-500 truncate">{user?.email}</p>
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-rose-600 hover:text-white transition"
                >
                    <LogOut className="w-4.5 h-4.5 shrink-0" />
                    Sign out
                </button>
            </div>
        </div>
    );
};

/**
 * App shell. The old version rendered a sidebar with `hidden lg:flex` and no
 * trigger anywhere, so on a phone the entire navigation was unreachable. This
 * version has a real header button and an overlay drawer.
 */
const AppLayout: React.FC = () => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const location = useLocation();
    const current = NAV.find((n) => n.to === location.pathname)?.label ?? 'Dashboard';

    return (
        <div className="min-h-screen bg-slate-100 lg:flex">
            {/* Desktop rail */}
            <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-slate-900 lg:h-screen lg:sticky lg:top-0">
                <SidebarContent />
            </aside>

            {/* Mobile drawer */}
            <div
                className={cn(
                    'lg:hidden fixed inset-0 z-50 transition-opacity duration-200',
                    drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
            >
                <div
                    className="absolute inset-0 bg-slate-900/50"
                    onClick={() => setDrawerOpen(false)}
                />
                <aside
                    className={cn(
                        'absolute inset-y-0 left-0 w-64 bg-slate-900 shadow-xl transition-transform duration-200',
                        drawerOpen ? 'translate-x-0' : '-translate-x-full'
                    )}
                >
                    <SidebarContent onNavigate={() => setDrawerOpen(false)} />
                </aside>
            </div>

            <div className="flex-1 min-w-0">
                {/* Mobile header with the trigger the old build was missing */}
                <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 h-14 px-4 bg-white border-b border-slate-200">
                    <button
                        onClick={() => setDrawerOpen(true)}
                        aria-label="Open navigation"
                        className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition"
                    >
                        <Menu className="w-5 h-5 text-slate-600" />
                    </button>
                    <span className="text-sm font-semibold text-slate-800">{current}</span>
                    {drawerOpen && (
                        <button
                            onClick={() => setDrawerOpen(false)}
                            aria-label="Close navigation"
                            className="ml-auto p-2 rounded-lg hover:bg-slate-100"
                        >
                            <X className="w-5 h-5 text-slate-600" />
                        </button>
                    )}
                </header>

                <main className="p-4 sm:p-6 max-w-7xl mx-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

/** Blocks the app until the stored token has been checked against the server. */
const RequireAuth: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
        );
    }

    return user ? <AppLayout /> : <Navigate to="/login" replace />;
};

const LoginRoute: React.FC = () => {
    const { user, loading } = useAuth();
    if (loading) return null;
    return user ? <Navigate to="/" replace /> : <Login />;
};

const App: React.FC = () => (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginRoute />} />
                    <Route element={<RequireAuth />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/bookings" element={<Bookings />} />
                        <Route path="/customers" element={<Customers />} />
                        <Route path="/technicians" element={<Technicians />} />
                        <Route path="/invoices" element={<Financials />} />
                        <Route path="/reports" element={<Reports />} />
                    </Route>
                    {/* Unknown paths fall back to the dashboard. */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    </QueryClientProvider>
);

export default App;
