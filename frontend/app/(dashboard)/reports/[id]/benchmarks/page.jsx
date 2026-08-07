'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertCircle,
    RefreshCw,
    Building2,
    BarChart3,
    Award,
    Target,
    Zap,
    Shield,
    TrendingUp as TrendUpIcon,
    TrendingDown as TrendDownIcon,
    Minus
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function BenchmarksPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const reportId = params.id;

    const [report, setReport] = useState(null);
    const [comparison, setComparison] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [benchmarks, setBenchmarks] = useState([]);

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

            const compareResult = await api.benchmarks.compare(reportId);
            setComparison(compareResult);
            
            const benchmarksData = await api.benchmarks.getAll();
            setBenchmarks(benchmarksData.benchmarks || []);
        } catch (err) {
            toast.error('Failed to load benchmark data');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            excellent: 'text-emerald-600 bg-emerald-50',
            good: 'text-blue-600 bg-blue-50',
            average: 'text-amber-600 bg-amber-50',
            below_average: 'text-orange-600 bg-orange-50',
            poor: 'text-red-600 bg-red-50',
            unknown: 'text-slate-600 bg-slate-50'
        };
        return colors[status] || colors.unknown;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'excellent': return <Award size={16} className="text-emerald-600" />;
            case 'good': return <Target size={16} className="text-blue-600" />;
            case 'average': return <Minus size={16} className="text-amber-600" />;
            case 'below_average': return <TrendDownIcon size={16} className="text-orange-600" />;
            case 'poor': return <AlertCircle size={16} className="text-red-600" />;
            default: return null;
        }
    };

    const getStatusLabel = (status) => {
        const labels = {
            excellent: 'Excellent',
            good: 'Good',
            average: 'Average',
            below_average: 'Below Average',
            poor: 'Needs Improvement',
            unknown: 'Unknown'
        };
        return labels[status] || 'Unknown';
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading benchmarks...</p>
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
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
                            <h1 className="text-2xl font-bold text-slate-900">Industry Benchmarks</h1>
                            <p className="text-sm text-slate-500">
                                {report.business_name} · Compare against industry standards
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadData}
                        className="p-2 hover:bg-slate-100 rounded-xl transition"
                    >
                        <RefreshCw size={18} className="text-slate-500" />
                    </button>
                </div>

                {comparison?.benchmark ? (
                    <>
                        {/* Industry Info */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                            <div className="flex items-center gap-3">
                                <Building2 size={20} className="text-indigo-600" />
                                <span className="font-semibold text-slate-900">Industry: {comparison.report.industry}</span>
                                <span className="text-sm text-slate-500">
                                    Based on industry average benchmarks
                                </span>
                            </div>
                        </div>

                        {/* Comparison Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Revenue</p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-lg font-bold text-slate-900">
                                        ₹{comparison.comparison.revenue.actual.toLocaleString()}
                                    </p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comparison.comparison.revenue.status)}`}>
                                        {getStatusIcon(comparison.comparison.revenue.status)}
                                        {getStatusLabel(comparison.comparison.revenue.status)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    vs ₹{comparison.comparison.revenue.benchmark?.toLocaleString()} industry avg
                                    {comparison.comparison.revenue.percentage !== 0 && (
                                        <span className={comparison.comparison.revenue.percentage > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                            {' '}({comparison.comparison.revenue.percentage > 0 ? '+' : ''}{comparison.comparison.revenue.percentage.toFixed(0)}%)
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">EBITDA</p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-lg font-bold text-slate-900">
                                        ₹{comparison.comparison.ebitda.actual.toLocaleString()}
                                    </p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comparison.comparison.ebitda.status)}`}>
                                        {getStatusIcon(comparison.comparison.ebitda.status)}
                                        {getStatusLabel(comparison.comparison.ebitda.status)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    vs ₹{comparison.comparison.ebitda.benchmark?.toLocaleString()} industry avg
                                    {comparison.comparison.ebitda.percentage !== 0 && (
                                        <span className={comparison.comparison.ebitda.percentage > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                            {' '}({comparison.comparison.ebitda.percentage > 0 ? '+' : ''}{comparison.comparison.ebitda.percentage.toFixed(0)}%)
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">SDE</p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-lg font-bold text-slate-900">
                                        ₹{comparison.comparison.sde.actual.toLocaleString()}
                                    </p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comparison.comparison.sde.status)}`}>
                                        {getStatusIcon(comparison.comparison.sde.status)}
                                        {getStatusLabel(comparison.comparison.sde.status)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    vs ₹{comparison.comparison.sde.benchmark?.toLocaleString()} industry avg
                                    {comparison.comparison.sde.percentage !== 0 && (
                                        <span className={comparison.comparison.sde.percentage > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                            {' '}({comparison.comparison.sde.percentage > 0 ? '+' : ''}{comparison.comparison.sde.percentage.toFixed(0)}%)
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Margin Comparison */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                            <h3 className="font-semibold text-slate-900 mb-4">Margin Comparison</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-slate-600">EBITDA Margin</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900">
                                                {comparison.comparison.ebitdaMargin.actual.toFixed(1)}%
                                            </span>
                                            <span className="text-xs text-slate-400">vs</span>
                                            <span className="text-sm text-slate-500">
                                                {comparison.comparison.ebitdaMargin.benchmark?.toFixed(1)}% industry avg
                                            </span>
                                            <span className={`text-xs font-medium ${
                                                comparison.comparison.ebitdaMargin.percentage > 0 ? 'text-emerald-600' : 'text-red-600'
                                            }`}>
                                                ({comparison.comparison.ebitdaMargin.percentage > 0 ? '+' : ''}
                                                {comparison.comparison.ebitdaMargin.percentage.toFixed(0)}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-indigo-600 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, Math.max(0, comparison.comparison.ebitdaMargin.actual))}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-slate-600">SDE Margin</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900">
                                                {comparison.comparison.sdeMargin.actual.toFixed(1)}%
                                            </span>
                                            <span className="text-xs text-slate-400">vs</span>
                                            <span className="text-sm text-slate-500">
                                                {comparison.comparison.sdeMargin.benchmark?.toFixed(1)}% industry avg
                                            </span>
                                            <span className={`text-xs font-medium ${
                                                comparison.comparison.sdeMargin.percentage > 0 ? 'text-emerald-600' : 'text-red-600'
                                            }`}>
                                                ({comparison.comparison.sdeMargin.percentage > 0 ? '+' : ''}
                                                {comparison.comparison.sdeMargin.percentage.toFixed(0)}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-violet-600 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, Math.max(0, comparison.comparison.sdeMargin.actual))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Insights */}
                        {comparison.insights && comparison.insights.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                <h3 className="font-semibold text-slate-900 mb-4">Key Insights</h3>
                                <div className="space-y-3">
                                    {comparison.insights.map((insight, index) => (
                                        <div 
                                            key={index} 
                                            className={`p-3 rounded-xl border ${
                                                insight.type === 'strength' ? 'border-emerald-200 bg-emerald-50' :
                                                insight.type === 'warning' ? 'border-amber-200 bg-amber-50' :
                                                insight.type === 'recommendation' ? 'border-blue-200 bg-blue-50' :
                                                'border-slate-200 bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="text-lg">{insight.icon}</span>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{insight.message}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5 capitalize">
                                                        Category: {insight.category}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Industry Multiples */}
                        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="font-semibold text-slate-900 mb-4">Industry Multiples</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-slate-50 rounded-xl p-4 text-center">
                                    <p className="text-xs text-slate-500">SDE Multiple</p>
                                    <p className="text-2xl font-bold text-indigo-600">
                                        {comparison.benchmark.sde_multiple_mid}x
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        Range: {comparison.benchmark.sde_multiple_min}x - {comparison.benchmark.sde_multiple_max}x
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 text-center">
                                    <p className="text-xs text-slate-500">EBITDA Multiple</p>
                                    <p className="text-2xl font-bold text-violet-600">
                                        {comparison.benchmark.ebitda_multiple_mid}x
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        Range: {comparison.benchmark.ebitda_multiple_min}x - {comparison.benchmark.ebitda_multiple_max}x
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 text-center">
                                    <p className="text-xs text-slate-500">Revenue Multiple</p>
                                    <p className="text-2xl font-bold text-emerald-600">
                                        {comparison.benchmark.revenue_multiple_mid}x
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        Range: {comparison.benchmark.revenue_multiple_min}x - {comparison.benchmark.revenue_multiple_max}x
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                        <BarChart3 size={48} className="text-slate-300 mx-auto mb-3" />
                        <h3 className="font-semibold text-slate-900">No Benchmarks Available</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            No industry benchmarks available for {report.industry || 'your industry'}.
                            Please update the report industry or contact support.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}