'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import NarrativeGenerator from '@/components/NarrativeGenerator';
import {
    ArrowLeft,
    FileText,
    Sparkles,
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function NarrativesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const reportId = params.id;

    const [report, setReport] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

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

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading narratives...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/reports/${reportId}`)}
                            className="p-2 hover:bg-slate-100 rounded-xl transition"
                        >
                            <ArrowLeft size={20} className="text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Narratives</h1>
                            <p className="text-sm text-slate-500">
                                {report?.business_name || 'Report'} · AI-Generated Content
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Sparkles size={16} className="text-indigo-600" />
                        <span>AI Powered</span>
                    </div>
                </div>

                {/* Narrative Generator */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <NarrativeGenerator 
                        reportId={reportId} 
                        businessName={report?.business_name}
                    />
                </div>

                {/* Info Card */}
                <div className="mt-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 p-4">
                    <div className="flex items-start gap-3">
                        <FileText size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-medium text-slate-900">About Narratives</h4>
                            <p className="text-sm text-slate-600">
                                AI-generated narratives help you quickly create professional content for your reports. 
                                Generate, edit, and copy sections for use in CIMs, teasers, and other documents.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}