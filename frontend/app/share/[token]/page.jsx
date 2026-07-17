'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
    FileText,
    Building2,
    Calendar,
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertCircle,
    Lock,
    Eye,
    Download,
    Printer
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShareViewPage() {
    const params = useParams();
    const router = useRouter();
    const token = params.token;

    const [report, setReport] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [addbacks, setAddbacks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [requiresPassword, setRequiresPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [allowDownload, setAllowDownload] = useState(false);
    const [allowPrint, setAllowPrint] = useState(true);

    useEffect(() => {
        if (token) {
            loadSharedReport();
        }
    }, [token]);

    const loadSharedReport = async (pwd = null) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.share.getPublic(token, pwd);
            setReport(data.report);
            setTransactions(data.transactions || []);
            setAddbacks(data.addbacks || []);
            setAllowDownload(data.allowDownload || false);
            setAllowPrint(data.allowPrint !== false);
        } catch (err) {
            if (err.status === 401 && err.requiresPassword) {
                setRequiresPassword(true);
                setError('This report is password protected');
            } else if (err.status === 410) {
                setError('This share link has expired or reached its maximum views');
            } else {
                setError(err.message || 'Failed to load report');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        loadSharedReport(password);
    };

    const handleDownload = async () => {
        try {
            const blob = await api.share.download(token);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${report.business_name}-Report.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Download started');
        } catch (err) {
            toast.error('Download failed');
        }
    };

    const money = (value) => {
        if (value === null || value === undefined) return '—';
        return Number(value).toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading report...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
                    {requiresPassword ? (
                        <>
                            <Lock size={48} className="text-indigo-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Password Required</h2>
                            <p className="text-sm text-slate-500 mb-4">
                                This report is password protected. Please enter the password to view it.
                            </p>
                            <form onSubmit={handlePasswordSubmit} className="space-y-3">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition"
                                >
                                    View Report
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={48} className="text-red-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Link Not Available</h2>
                            <p className="text-sm text-slate-500">{error}</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <AlertCircle size={48} className="text-red-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-900">Report not found</h2>
                    <p className="text-sm text-slate-500">The report you&apos;re looking for doesn&apos;t exist.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-8">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg flex-shrink-0">
                                <FileText className="text-white" size={20} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{report.business_name}</h1>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-sm text-slate-500 flex items-center gap-1">
                                        <Building2 size={14} />
                                        {report.industry || 'Industry not specified'}
                                    </span>
                                    <span className="text-xs text-slate-300">•</span>
                                    <span className="text-sm text-slate-500 flex items-center gap-1">
                                        <Calendar size={14} />
                                        Shared Report
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {allowPrint && (
                                <button
                                    onClick={() => window.print()}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition"
                                >
                                    <Printer size={18} className="text-slate-500" />
                                </button>
                            )}
                            {allowDownload && (
                                <button
                                    onClick={handleDownload}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition"
                                >
                                    <Download size={18} className="text-slate-500" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Revenue</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">{money(report.total_revenue)}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">EBITDA</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">{money(report.ebitda)}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">SDE</p>
                        <p className="text-lg font-bold text-indigo-600 mt-1">{money(report.sde)}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Add-backs</p>
                        <p className="text-lg font-bold text-emerald-600 mt-1">{money(report.total_addbacks)}</p>
                    </div>
                </div>

                {/* AI Summary */}
                {report.ai_summary && (
                    <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-6 mb-6">
                        <h3 className="text-sm font-semibold text-slate-900 mb-1">Executive Summary</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">{report.ai_summary}</p>
                    </div>
                )}

                {/* Add-backs */}
                {addbacks.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h3 className="font-semibold text-slate-900">Add-back Schedule</h3>
                        </div>
                        <div className="divide-y divide-slate-200">
                            {addbacks.map((a) => (
                                <div key={a.id} className="flex items-center justify-between px-6 py-3">
                                    <span className="text-sm text-slate-700">{a.label}</span>
                                    <span className="text-sm font-semibold text-indigo-600">{money(a.amount)}</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-50 to-violet-50">
                                <span className="font-semibold text-slate-900">Total Add-backs</span>
                                <span className="font-bold text-indigo-600">{money(report.total_addbacks)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Transactions Preview */}
                {transactions.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h3 className="font-semibold text-slate-900">
                                Transaction Preview 
                                <span className="ml-2 text-xs text-slate-500">({transactions.length} transactions)</span>
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Description</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Category</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {transactions.slice(0, 20).map((t) => (
                                        <tr key={t.id} className={t.is_addback ? 'bg-amber-50' : ''}>
                                            <td className="px-4 py-2 text-slate-900">
                                                {t.description}
                                                {t.is_addback && (
                                                    <span className="ml-2 text-xs text-amber-600 font-medium">(Add-back)</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-slate-600">{t.category}</td>
                                            <td className="px-4 py-2 text-right font-medium text-slate-900">
                                                {money(t.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {transactions.length > 20 && (
                                <div className="px-6 py-3 text-center text-sm text-slate-500 border-t border-slate-200">
                                    +{transactions.length - 20} more transactions
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-200 pt-6">
                    This report was shared securely using Ledger AI · {new Date().toLocaleDateString()}
                </div>
            </div>
        </div>
    );
}