'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard,
    Upload,
    Store,
    FileText,
    LogOut,
    User,
    Settings,
    Palette,
    Landmark,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    BarChart3,
    ClipboardCheck,
    Calculator,
    TrendingUp,
    Briefcase,
    Users,
    Star,
    Zap,
    Shield,
    Bell,
    HelpCircle,
    Menu,
    X,
} from 'lucide-react';

const NAV_ITEMS = [
    {
        section: 'Main',
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { name: 'Upload Report', href: '/dashboard/upload', icon: Upload },
        ]
    },
    {
        section: 'Marketplace',
        items: [
            { name: 'Businesses', href: '/marketplace', icon: Store },
        ]
    },
    {
        section: 'Settings',
        items: [
            { name: 'Profile', href: '/profile', icon: User },
            { name: 'Branding', href: '/settings/branding', icon: Palette },
            { name: 'Settings', href: '/dashboard/settings', icon: Settings },
        ]
    },
];

export default function Sidebar({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const isActive = (href) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        if (href === '/reports') return pathname.startsWith('/reports') && pathname !== '/dashboard';
        return pathname.startsWith(href);
    };

    const getInitials = (fullName) => {
        if (!fullName) return 'U';
        const parts = fullName.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return fullName.slice(0, 2).toUpperCase();
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside 
                className={`
                    fixed top-0 left-0 z-50 h-full bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-700/80
                    transition-all duration-300 ease-in-out flex flex-col
                    ${isCollapsed ? 'w-20' : 'w-64'}
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {/* Logo */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200/80 dark:border-slate-700/80 flex-shrink-0">
                    <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg flex-shrink-0">
                            <Landmark className="text-white" size={18} />
                        </div>
                        {!isCollapsed && (
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">Ledger AI</h1>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate">Financial Restatement</p>
                            </div>
                        )}
                    </Link>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition flex-shrink-0"
                    >
                        {isCollapsed ? (
                            <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
                        ) : (
                            <ChevronLeft size={18} className="text-slate-400 dark:text-slate-500" />
                        )}
                    </button>
                    <button
                        onClick={() => setIsMobileOpen(false)}
                        className="lg:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                        <X size={20} className="text-slate-500 dark:text-slate-400" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                    {NAV_ITEMS.map((section) => (
                        <div key={section.section}>
                            {!isCollapsed && (
                                <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                    {section.section}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`
                                                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                                                ${active 
                                                    ? 'bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 text-indigo-700 dark:text-indigo-400 font-medium' 
                                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                                }
                                                ${isCollapsed ? 'justify-center' : 'justify-start'}
                                            `}
                                            title={isCollapsed ? item.name : ''}
                                        >
                                            <Icon 
                                                size={20} 
                                                className={active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} 
                                            />
                                            {!isCollapsed && (
                                                <span className="text-sm text-slate-700 dark:text-slate-300">{item.name}</span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Bottom Section - User Profile & Logout */}
                <div className="border-t border-slate-200/80 dark:border-slate-700/80 p-3 space-y-2 flex-shrink-0">
                    {!isCollapsed && (
                        <div className="flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {user?.full_name ? getInitials(user.full_name) : 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {user?.full_name || 'User'}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {user?.email || 'user@email.com'}
                                </p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition
                            ${isCollapsed ? 'justify-center' : 'justify-start'}
                        `}
                        title={isCollapsed ? 'Logout' : ''}
                    >
                        <LogOut size={20} className="flex-shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
                    </button>
                </div>
            </aside>

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
            `}</style>
        </>
    );
}