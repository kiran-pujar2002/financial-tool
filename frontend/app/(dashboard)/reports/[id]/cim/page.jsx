'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
    ArrowLeft,
    FileText,
    Download,
    RefreshCw,
    AlertCircle,
    Building2,
    DollarSign,
    TrendingUp,
    Sparkles,
    Clock,
    CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CIMPage() {
    const { user, loading: authLoading } = useAuth();
    const [isDownloading, setIsDownloading] = useState(false);
    const router = useRouter();
    const params = useParams();
    const reportId = params.id;

    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStatus, setGenerationStatus] = useState('idle'); // idle, generating, complete, error

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
            return;
        }
        if (user) {
            loadData();
        }
    }, [user, authLoading, reportId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const reportData = await api.getReport(reportId);
            setReport(reportData.report);
        } catch (err) {
            toast.error('Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGenerationStatus('generating');
        try {
            const response = await api.cim.generate({ reportId });
            
            if (response.success && response.downloadUrl) {
                setGenerationStatus('complete');
                setIsDownloading(true);
                await downloadFile(response.downloadUrl);
                toast.success('CIM downloaded successfully!');
            }
        } catch (err) {
            setGenerationStatus('error');
            toast.error('Failed to generate CIM');
        } finally {
            setIsGenerating(false);
            setIsDownloading(false);
        }
    };

    // ✅ Download function with authentication
    const downloadFile = async (url) => {
        try {
            const token = localStorage.getItem('token');
            const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${url}`;
            
            const response = await fetch(fullUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `CIM-Report-${report?.business_name || 'Business'}.pdf`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    filename = match[1].replace(/['"]/g, '');
                }
            }
            
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
        } catch (error) {
            console.error('Download error:', error);
            throw new Error('Failed to download file');
        }
    };

    const formatCurrency = (value) => {
        if (!value) return '—';
        return Number(value).toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/30">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/30">
                <div className="text-center">
                    <AlertCircle size={48} className="text-red-600 dark:text-red-400 mx-auto mb-3" />
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-4">Report not found</h2>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/30 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push(`/reports/${reportId}`)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                    >
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CIM Report</h1>
                            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-medium">
                                Confidential
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {report.business_name} · Confidential Information Memorandum
                        </p>
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                            <FileText size={24} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">What is a CIM?</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                A Confidential Information Memorandum (CIM) is a professional document used to market your business to potential buyers. It includes executive summary, business overview, financial performance, growth opportunities, and valuation guidance.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Business Summary */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Business Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Business Name</p>
                            <p className="font-medium text-slate-900 dark:text-white text-sm">{report.business_name}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Industry</p>
                            <p className="font-medium text-slate-900 dark:text-white text-sm">{report.industry || 'Not specified'}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Revenue</p>
                            <p className="font-medium text-indigo-600 dark:text-indigo-400 text-sm">
                                {formatCurrency(report.total_revenue)}
                            </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">EBITDA</p>
                            <p className="font-medium text-slate-900 dark:text-white text-sm">
                                {formatCurrency(report.ebitda)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3 relative overflow-hidden group"
                >
                    {isGenerating ? (
                        <>
                            <RefreshCw size={20} className="animate-spin" />
                            Generating CIM...
                            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </>
                    ) : generationStatus === 'complete' ? (
                        <>
                            <CheckCircle size={20} />
                            CIM Generated Successfully!
                        </>
                    ) : (
                        <>
                            <Sparkles size={20} />
                            Generate CIM Report
                            <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                        </>
                    )}
                </button>

                {generationStatus === 'complete' && (
                    <div className="mt-4 text-center">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2">
                            <CheckCircle size={16} />
                            Your CIM report has been generated and downloaded
                        </p>
                    </div>
                )}

                {generationStatus === 'error' && (
                    <div className="mt-4 text-center">
                        <p className="text-sm text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
                            <AlertCircle size={16} />
                            Failed to generate CIM. Please try again.
                        </p>
                    </div>
                )}

                <div className="mt-4 text-xs text-slate-400 dark:text-slate-500 text-center space-y-1">
                    <p>The CIM will include all financial data, add-back analysis, and valuation guidance.</p>
                    <p className="text-[10px] text-slate-400/70">Document is confidential and intended for qualified buyers only</p>
                </div>

                {/* Quick Tips */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
                        <FileText size={16} className="text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Professional Format</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Investment-grade document</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
                        <Building2 size={16} className="text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Business Overview</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Complete business profile</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
                        <TrendingUp size={16} className="text-violet-600 dark:text-violet-400 mx-auto mb-1" />
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Valuation Guidance</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Indicative valuation range</p>
                    </div>
                </div>
            </div>
        </div>
    );
}