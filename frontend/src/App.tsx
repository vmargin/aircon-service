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
    ChevronRight
} from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Financials from './components/Financials';
import Customers from './components/Customers';
import Reports from './components/Reports';
import Technicians from './components/Technicians';
import type { User } from './types';

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'financials' | 'customers' | 'reports' | 'technicians'>('dashboard');

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
    };

    if (!user) {
        return <Login onLoginSuccess={(userData) => setUser(userData)} />;
    }

    const navItems = [
        { id: 'dashboard', label: 'Bookings', icon: LayoutDashboard },
        { id: 'financials', label: 'Financials', icon: DollarSign },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'technicians', label: 'Technicians', icon: UserIcon },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
    ] as const;

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* SIDEBAR NAVIGATION */}
            <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col z-50">
                <div className="p-8 border-b border-slate-50 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                        <LayoutDashboard className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="font-black text-slate-800 tracking-tight leading-none uppercase text-lg">Arctic</h1>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Manager</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-8 space-y-2">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group ${activeTab === item.id
                                ? 'bg-blue-50 text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-50">
                    <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{user.email}</p>
                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">
                                {user.role === 'ADMIN' ? 'Admin' : (user.branchName || user.role)}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 hover:bg-white hover:text-red-500 rounded-lg transition-all text-slate-400"
                            title="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* TOP BAR */}
            <header className="lg:pl-64 h-20 bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="h-full px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-slate-400 text-sm font-medium">
                        <span className="hover:text-slate-900 cursor-pointer">{user.orgName}</span>
                        <ChevronRight className="w-4 h-4" />
                        <span className="text-slate-900 font-bold">{activeTab}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <button className="relative p-2 text-slate-400 hover:text-slate-900 transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-black text-slate-500 uppercase tracking-tighter">
                            <Settings className="w-4 h-4" />
                            Branch Portal
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="lg:pl-64 pt-8 pb-12">
                <div className="px-8 max-w-7xl mx-auto">
                    {activeTab === 'dashboard' && <Dashboard />}
                    {activeTab === 'financials' && <Financials />}
                    {activeTab === 'customers' && <Customers />}
                    {activeTab === 'reports' && <Reports />}
                    {activeTab === 'technicians' && <Technicians />}
                </div>
            </main>
        </div>
    );
}

export default App;
