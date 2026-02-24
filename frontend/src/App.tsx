import { useState, useEffect } from 'react';
import {
    LogOut,
    User as UserIcon,
    LayoutDashboard,
    Users,
    DollarSign,
    Settings,
    Bell,
    BarChart3,
    ChevronRight,
    Plus,
    Search,
    X,
    Globe,
    TrendingUp,
    Shield,
    Package,
    Zap
} from 'lucide-react';
import Card from './components/ui/Card';
import StatusBadge from './components/ui/StatusBadge';
import Dashboard from './components/Dashboard';
import Financials from './components/Financials';
import Customers from './components/Customers';
import Reports from './components/Reports';
import Technicians from './components/Technicians';
import Login from './components/Login';
import Toast from './components/ui/Toast';
import type { User } from './types';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'financials' | 'customers' | 'reports' | 'technicians'>('dashboard');
    const [toastQueue, setToastQueue] = useState<{ id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }[]>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error("Failed to parse user from localStorage", e);
                localStorage.removeItem('user');
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        showNotification('Logged out successfully', 'success');
    };

    const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
        const id = Date.now().toString();
        setToastQueue(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToastQueue(prev => prev.filter(toast => toast.id !== id));
        }, 3000);
    };

    if (!user) {
        return <Login onLoginSuccess={(userData) => setUser(userData)} />;
    }

    const navItems = [
        { id: 'dashboard', label: 'Bookings', icon: LayoutDashboard, description: 'Manage service appointments and technician dispatch' },
        { id: 'financials', label: 'Financials', icon: DollarSign, description: 'Track revenue, invoices, and payments' },
        { id: 'customers', label: 'Customers', icon: Users, description: 'Manage client information and history' },
        { id: 'technicians', label: 'Technicians', icon: UserIcon, description: 'Manage service technicians and schedules' },
        { id: 'reports', label: 'Reports', icon: BarChart3, description: 'View analytics and performance metrics' },
    ] as const;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Toast Notifications */}
            {toastQueue.map(toast => (
                <Toast
                    key={toast.id}
                    id={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={(id) => setToastQueue(prev => prev.filter(t => t.id !== id))}
                />
            ))}

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            <div className="flex min-h-screen">
                {/* SIDEBAR NAVIGATION */}
                <aside className="fixed left-0 top-0 h-full w-64 bg-gradient-to-br from-slate-900 to-slate-800 border-r border-slate-700 z-50 lg:static lg:border-0">
                    <div className="p-8 border-b border-slate-800 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group">
                            <LayoutDashboard className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-center">
                            <h1 className="font-black text-white tracking-tight leading-none uppercase text-lg">Arctic</h1>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Service Manager</span>
                        </div>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <nav className="flex-1 px-4 py-8 space-y-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    setIsMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group ${activeTab === item.id
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold">{item.label}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                                        {item.description}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-slate-800">
                        <div className="p-4 bg-slate-800 rounded-2xl flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                <UserIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{user.email}</p>
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">
                                    {user.role === 'ADMIN' ? 'Admin' : (user.branchName || user.role)}
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 hover:bg-slate-700 hover:text-red-400 rounded-lg transition-all text-slate-400"
                                title="Logout"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </aside>

                {/* MAIN CONTENT AREA */}
                <main className="flex-1 lg:pl-64">
                    {/* TOP BAR */}
                    <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-40">
                        <div className="h-full px-8 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-slate-400 text-sm font-medium">
                                <span className="hover:text-slate-900 cursor-pointer font-bold">{user.orgName}</span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-900 font-bold">{activeTab}</span>
                            </div>
                            <div className="flex items-center gap-6">
                                <button className="relative p-2 text-slate-400 hover:text-slate-900 transition-colors group">
                                    <Bell className="w-5 h-5" />
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white group-hover:scale-110 transition-transform" />
                                </button>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-black text-slate-500 uppercase tracking-tighter group">
                                    <Settings className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                    Branch Portal
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* CONTENT WITH ANIMATIONS */}
                    <div className="pt-8 pb-12 px-8 max-w-7xl mx-auto">
                        <div className="animate-in fade-in slide-in-top-2 duration-700">
                            {activeTab === 'dashboard' && <Dashboard showNotification={showNotification} />}
                            {activeTab === 'financials' && <Financials showNotification={showNotification} />}
                            {activeTab === 'customers' && <Customers showNotification={showNotification} />}
                            {activeTab === 'reports' && <Reports showNotification={showNotification} />}
                            {activeTab === 'technicians' && <Technicians showNotification={showNotification} />}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default App;