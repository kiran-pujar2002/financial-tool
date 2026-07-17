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
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CIMPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const reportId = params.id;

    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

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
        try {
            // Generate the CIM
            const response = await api.cim.generate({ reportId });
            
            if (response.success && response.downloadUrl) {
                // ✅ Download using fetch with auth token
                await downloadFile(response.downloadUrl);
                toast.success('CIM generated and downloaded successfully!');
            } else {
                toast.error('Failed to generate CIM');
            }
        } catch (err) {
            toast.error('Failed to generate CIM');
            console.error(err);
        } finally {
            setIsGenerating(false);
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

            // Get the blob from response
            const blob = await response.blob();
            
            // Create download link
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            
            // Extract filename from content-disposition header or use default
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'CIM-Report.pdf';
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

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="text-red-600 mx-auto" size={48} />
                    <h2 className="text-xl font-semibold text-slate-900 mt-4">Report not found</h2>
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push(`/reports/${reportId}`)}
                        className="p-2 hover:bg-slate-100 rounded-xl transition"
                    >
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">CIM Report</h1>
                        <p className="text-sm text-slate-500">
                            {report.business_name} · Confidential Information Memorandum
                        </p>
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <FileText className="text-indigo-600" size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">What is a CIM?</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                A Confidential Information Memorandum (CIM) is a professional document used to market your business to potential buyers. It includes executive summary, business overview, financial performance, growth opportunities, and valuation guidance.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Business Summary */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Business Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-500">Business Name</p>
                            <p className="font-medium">{report.business_name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Industry</p>
                            <p className="font-medium">{report.industry || 'Not specified'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Revenue</p>
                            <p className="font-medium text-indigo-600">
                                {Number(report.total_revenue || 0).toLocaleString('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 0
                                })}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">EBITDA</p>
                            <p className="font-medium">
                                {Number(report.ebitda || 0).toLocaleString('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 0
                                })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    {isGenerating ? (
                        <>
                            <RefreshCw size={20} className="animate-spin" />
                            Generating CIM...
                        </>
                    ) : (
                        <>
                            <Download size={20} />
                            Generate CIM Report
                        </>
                    )}
                </button>

                <p className="text-xs text-slate-400 text-center mt-4">
                    The CIM will include all financial data, add-back analysis, and valuation guidance.
                </p>
            </div>
        </div>
    );
}