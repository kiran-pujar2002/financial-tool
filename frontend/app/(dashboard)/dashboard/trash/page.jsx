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
    ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrashPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [reports, setReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
            return;
        }
        if (user) {
            loadTrash();
        }
    }, [user, authLoading]);

    const loadTrash = async () => {
        setIsLoading(true);
        try {
            const data = await api.getTrashedReports();
            setReports(data.reports || []);
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

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading trash...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="p-2 hover:bg-slate-100 rounded-xl transition"
                        >
                            <ArrowLeft size={20} className="text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">Trash</h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Reports you've deleted. They can be restored within 30 days.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadTrash}
                        className="p-2 hover:bg-slate-100 rounded-xl transition"
                    >
                        <RefreshCw size={18} className="text-slate-500" />
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {reports.length === 0 && !error ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                        <Trash2 size={48} className="text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">Trash is empty</h3>
                        <p className="text-sm text-slate-500">
                            Deleted reports will appear here for 30 days.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="divide-y divide-slate-200">
                            {reports.map((r) => (
                                <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                                            <FileText className="text-red-600" size={16} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{r.business_name}</p>
                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Building2 size={12} />
                                                    {r.industry || 'No industry'}
                                                </span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    Deleted: {new Date(r.deleted_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRestore(r.id)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-medium hover:bg-emerald-100 transition"
                                    >
                                        <Undo2 size={16} />
                                        Restore
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}