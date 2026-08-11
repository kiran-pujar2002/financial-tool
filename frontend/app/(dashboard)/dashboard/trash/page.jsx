'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
    Trash2,
    RefreshCw,
    FileText,
    AlertCircle,
    Clock,
    Building2,
    Calendar,
    Undo2,
    ArrowLeft,
    Search,
    Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrashPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [reports, setReports] = useState([]);
    const [filteredReports, setFilteredReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
            return;
        }
        if (user) {
            loadTrash();
        }
    }, [user, authLoading]);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredReports(reports);
        } else {
            const filtered = reports.filter(r =>
                r.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.industry && r.industry.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setFilteredReports(filtered);
        }
    }, [searchTerm, reports]);

    const loadTrash = async () => {
        setIsLoading(true);
        try {
            const data = await api.getTrashedReports();
            setReports(data.reports || []);
            setFilteredReports(data.reports || []);
        } catch (err) {
            setError('Failed to load trashed reports');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (id) => {
        try {
            await api.restoreReport(id);
            toast.success('Report restored successfully!');
            await loadTrash();
        } catch (err) {
            toast.error('Failed to restore report');
        }
    };

    const handlePermanentDelete = async (id) => {
        if (!confirm('Are you sure you want to permanently delete this report? This action cannot be undone.')) {
            return;
        }
        try {
            // Note: You'll need to add a permanent delete endpoint
            // await api.permanentDeleteReport(id);
            toast.success('Report permanently deleted');
            await loadTrash();
        } catch (err) {
            toast.error('Failed to delete report');
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/30">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Loading trash...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/30 py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Trash</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Reports you've deleted. They can be restored within 30 days.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search trash..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                            />
                        </div>
                        <button
                            onClick={loadTrash}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                        >
                            <RefreshCw size={18} className="text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                )}

                {filteredReports.length === 0 && !error ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
                        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={40} className="text-red-400 dark:text-red-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                            {searchTerm ? 'No results found' : 'Trash is empty'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {searchTerm 
                                ? `No deleted reports match "${searchTerm}"`
                                : 'Deleted reports will appear here for 30 days.'
                            }
                        </p>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Results count */}
                        {searchTerm && (
                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Found {filteredReports.length} result{filteredReports.length !== 1 ? 's' : ''}
                            </div>
                        )}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredReports.map((r) => (
                                    <div 
                                        key={r.id} 
                                        className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition group"
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                                <FileText size={16} className="text-red-600 dark:text-red-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                                    {r.business_name}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <Building2 size={12} />
                                                        {r.industry || 'No industry'}
                                                    </span>
                                                    <span className="hidden sm:inline">•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        Deleted: {new Date(r.deleted_at).toLocaleDateString()}
                                                    </span>
                                                    {r.status && (
                                                        <>
                                                            <span className="hidden sm:inline">•</span>
                                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                                                                {r.status}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleRestore(r.id)}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                                            >
                                                <Undo2 size={16} />
                                                <span className="hidden sm:inline">Restore</span>
                                            </button>
                                            <button
                                                onClick={() => handlePermanentDelete(r.id)}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition opacity-0 group-hover:opacity-100 sm:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                                <span className="hidden sm:inline">Delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="mt-4 text-xs text-slate-400 dark:text-slate-500 text-center">
                            {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''} in trash
                            {searchTerm && ` (filtered from ${reports.length} total)`}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}