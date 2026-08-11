'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { Menu, Bell, Search, Sparkles, Sun, Moon, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

export default function DashboardLayout({ children }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const pathname = usePathname();
    const { user } = useAuth();
    
    // ✅ Safely use theme - will only work if ThemeProvider is in the tree
    let theme, toggleTheme, isDark;
    try {
        const themeContext = useTheme();
        theme = themeContext.theme;
        toggleTheme = themeContext.toggleTheme;
        isDark = themeContext.isDark;
    } catch (e) {
        // If ThemeProvider is not found, use fallback
        theme = 'light';
        toggleTheme = () => {};
        isDark = false;
        console.warn('ThemeProvider not found, using fallback');
    }

    // Get page title from pathname
    const getPageTitle = () => {
        const path = pathname?.split('/').filter(Boolean);
        if (!path) return 'Dashboard';
        if (path.length === 1) return path[0].charAt(0).toUpperCase() + path[0].slice(1);
        if (path[0] === 'reports' && path[1] === '[id]') return 'Report Detail';
        if (path[0] === 'reports' && path[1] === 'edit') return 'Edit Report';
        if (path[0] === 'reports' && path[1] === 'valuation') return 'Valuation';
        if (path[0] === 'reports' && path[1] === 'due-diligence') return 'Due Diligence';
        if (path[0] === 'reports' && path[1] === 'financial-modeling') return 'Financial Modeling';
        if (path[0] === 'reports' && path[1] === 'narratives') return 'Narratives';
        if (path[0] === 'reports' && path[1] === 'cim') return 'CIM Report';
        if (path[0] === 'marketplace') return 'Marketplace';
        if (path[0] === 'settings' && path[1] === 'branding') return 'Branding';
        if (path[0] === 'dashboard' && path[1] === 'profile') return 'Profile';
        if (path[0] === 'dashboard' && path[1] === 'upload') return 'Upload Report';
        if (path[0] === 'dashboard' && path[1] === 'settings') return 'Settings';
        if (path[0] === 'dashboard' && path[1] === 'trash') return 'Trash';
        return path[path.length - 1].charAt(0).toUpperCase() + path[path.length - 1].slice(1);
    };

    const getPageEmoji = () => {
        if (pathname === '/dashboard') return '📊';
        if (pathname?.includes('/upload')) return '📤';
        if (pathname?.includes('/marketplace')) return '🏪';
        if (pathname?.includes('/valuation')) return '💰';
        if (pathname?.includes('/due-diligence')) return '🔍';
        if (pathname?.includes('/financial-modeling')) return '📈';
        if (pathname?.includes('/narratives')) return '📝';
        if (pathname?.includes('/cim')) return '📄';
        if (pathname?.includes('/profile')) return '👤';
        if (pathname?.includes('/branding')) return '🎨';
        if (pathname?.includes('/trash')) return '🗑️';
        return '✨';
    };

    const getPageDescription = () => {
        if (pathname === '/dashboard') return 'Overview of all your reports and activities';
        if (pathname?.includes('/upload')) return 'Upload financial statements for AI analysis';
        if (pathname?.includes('/marketplace')) return 'Discover and list businesses for sale';
        if (pathname?.includes('/valuation')) return 'Calculate business valuation with AI';
        if (pathname?.includes('/due-diligence')) return 'Track due diligence checklist progress';
        if (pathname?.includes('/financial-modeling')) return 'Build financial projections and scenarios';
        if (pathname?.includes('/narratives')) return 'Generate AI-powered report narratives';
        if (pathname?.includes('/cim')) return 'Generate Confidential Information Memorandum';
        if (pathname?.includes('/profile')) return 'Manage your personal information';
        if (pathname?.includes('/branding')) return 'Customize your report branding';
        if (pathname?.includes('/trash')) return 'View and restore deleted reports';
        return 'Manage your financial analysis and reports';
    };

    // Keyboard shortcut for search (⌘K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
            if (e.key === 'Escape') {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 transition-colors duration-200">
            <Sidebar 
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                isMobileOpen={isMobileOpen}
                setIsMobileOpen={setIsMobileOpen}
            />

            {/* Main Content */}
            <div className={`
                transition-all duration-300 ease-in-out
                ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}
                ml-0
            `}>
                {/* Top Bar */}
                <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 transition-colors duration-200">
                    <div className="flex items-center justify-between h-16 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsMobileOpen(true)}
                                className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            >
                                <Menu size={20} className="text-slate-600 dark:text-slate-400" />
                            </button>
                            <div className="flex items-center gap-3">
                                <span className="text-xl">{getPageEmoji()}</span>
                                <div>
                                    <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{getPageTitle()}</h1>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">{getPageDescription()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <Search size={16} className="text-slate-400 dark:text-slate-500" />
                                <span className="text-sm text-slate-500 dark:text-slate-400">Search...</span>
                                <kbd className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">⌘K</kbd>
                            </button>

                            {/* Notifications */}
                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition relative">
                                <Bell size={18} className="text-slate-600 dark:text-slate-400" />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                            </button>

                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition relative"
                                aria-label="Toggle theme"
                            >
                                {isDark ? (
                                    <Sun size={18} className="text-yellow-500" />
                                ) : (
                                    <Moon size={18} className="text-slate-600 dark:text-slate-400" />
                                )}
                            </button>

                            {/* User Avatar (Mobile) */}
                            <div className="lg:hidden">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Search Modal */}
                {isSearchOpen && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                            <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
                                <Search size={20} className="text-slate-400 dark:text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search reports, businesses, or documents..."
                                    className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                                    autoFocus
                                />
                                <button
                                    onClick={() => setIsSearchOpen(false)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                                >
                                    <X size={18} className="text-slate-400 dark:text-slate-500" />
                                </button>
                            </div>
                            <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                                <p>Search for reports, businesses, or documents...</p>
                                <p className="text-xs mt-2">Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">ESC</kbd> to close</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Page Content */}
                <main className="p-4 sm:p-6">
                    {children}
                </main>
            </div>

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-in {
                    from { 
                        opacity: 0;
                        transform: scale(0.95) translateY(-10px);
                    }
                    to { 
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
                .animate-scale-in {
                    animation: scale-in 0.2s ease-out;
                }
            `}</style>
        </div>
    );
}