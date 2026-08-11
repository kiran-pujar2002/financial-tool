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
    Minus,
    Sparkles
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
            excellent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',
            good: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',
            average: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
            below_average: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400',
            poor: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400',
            unknown: 'text-slate-600 bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400'
        };
        return colors[status] || colors.unknown;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'excellent': return <Award size={16} className="text-emerald-600 dark:text-emerald-400" />;
            case 'good': return <Target size={16} className="text-blue-600 dark:text-blue-400" />;
            case 'average': return <Minus size={16} className="text-amber-600 dark:text-amber-400" />;
            case 'below_average': return <TrendDownIcon size={16} className="text-orange-600 dark:text-orange-400" />;
            case 'poor': return <AlertCircle size={16} className="text-red-600 dark:text-red-400" />;
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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/30">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Loading benchmarks...</p>
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
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/30 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/reports/${reportId}`)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Industry Benchmarks</h1>
                                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-medium">
                                    AI Powered
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {report.business_name} · Compare against industry standards
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadData}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                    >
                        <RefreshCw size={18} className="text-slate-500 dark:text-slate-400" />
                    </button>
                </div>

                {comparison?.benchmark ? (
                    <>
                        {/* Industry Info */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <Building2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-900 dark:text-white">Industry: {comparison.report.industry}</span>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Based on industry average benchmarks
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Comparison Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revenue</p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(comparison.comparison.revenue.actual)}
                                    </p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comparison.comparison.revenue.status)}`}>
                                        {getStatusIcon(comparison.comparison.revenue.status)}
                                        {getStatusLabel(comparison.comparison.revenue.status)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    vs {formatCurrency(comparison.comparison.revenue.benchmark)} industry avg
                                    {comparison.comparison.revenue.percentage !== 0 && (
                                        <span className={comparison.comparison.revenue.percentage > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                            {' '}({comparison.comparison.revenue.percentage > 0 ? '+' : ''}{comparison.comparison.revenue.percentage.toFixed(0)}%)
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">EBITDA</p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(comparison.comparison.ebitda.actual)}
                                    </p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comparison.comparison.ebitda.status)}`}>
                                        {getStatusIcon(comparison.comparison.ebitda.status)}
                                        {getStatusLabel(comparison.comparison.ebitda.status)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    vs {formatCurrency(comparison.comparison.ebitda.benchmark)} industry avg
                                    {comparison.comparison.ebitda.percentage !== 0 && (
                                        <span className={comparison.comparison.ebitda.percentage > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                            {' '}({comparison.comparison.ebitda.percentage > 0 ? '+' : ''}{comparison.comparison.ebitda.percentage.toFixed(0)}%)
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">SDE</p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(comparison.comparison.sde.actual)}
                                    </p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comparison.comparison.sde.status)}`}>
                                        {getStatusIcon(comparison.comparison.sde.status)}
                                        {getStatusLabel(comparison.comparison.sde.status)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    vs {formatCurrency(comparison.comparison.sde.benchmark)} industry avg
                                    {comparison.comparison.sde.percentage !== 0 && (
                                        <span className={comparison.comparison.sde.percentage > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                            {' '}({comparison.comparison.sde.percentage > 0 ? '+' : ''}{comparison.comparison.sde.percentage.toFixed(0)}%)
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Margin Comparison */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Margin Comparison</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">EBITDA Margin</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                                                {comparison.comparison.ebitdaMargin.actual.toFixed(1)}%
                                            </span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500">vs</span>
                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                {comparison.comparison.ebitdaMargin.benchmark?.toFixed(1)}% industry avg
                                            </span>
                                            <span className={`text-xs font-medium ${
                                                comparison.comparison.ebitdaMargin.percentage > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                            }`}>
                                                ({comparison.comparison.ebitdaMargin.percentage > 0 ? '+' : ''}
                                                {comparison.comparison.ebitdaMargin.percentage.toFixed(0)}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, Math.max(0, comparison.comparison.ebitdaMargin.actual))}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">SDE Margin</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                                                {comparison.comparison.sdeMargin.actual.toFixed(1)}%
                                            </span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500">vs</span>
                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                {comparison.comparison.sdeMargin.benchmark?.toFixed(1)}% industry avg
                                            </span>
                                            <span className={`text-xs font-medium ${
                                                comparison.comparison.sdeMargin.percentage > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                            }`}>
                                                ({comparison.comparison.sdeMargin.percentage > 0 ? '+' : ''}
                                                {comparison.comparison.sdeMargin.percentage.toFixed(0)}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-violet-600 dark:bg-violet-500 rounded-full transition-all"
                                            style={{ width: `${Math.min(100, Math.max(0, comparison.comparison.sdeMargin.actual))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Insights */}
                        {comparison.insights && comparison.insights.length > 0 && (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    <h3 className="font-semibold text-slate-900 dark:text-white">Key Insights</h3>
                                </div>
                                <div className="space-y-3">
                                    {comparison.insights.map((insight, index) => (
                                        <div 
                                            key={index} 
                                            className={`p-3 rounded-xl border ${
                                                insight.type === 'strength' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20' :
                                                insight.type === 'warning' ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20' :
                                                insight.type === 'recommendation' ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20' :
                                                'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="text-lg">{insight.icon}</span>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{insight.message}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
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
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Industry Multiples</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">SDE Multiple</p>
                                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                        {comparison.benchmark.sde_multiple_mid}x
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                        Range: {comparison.benchmark.sde_multiple_min}x - {comparison.benchmark.sde_multiple_max}x
                                    </p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">EBITDA Multiple</p>
                                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                                        {comparison.benchmark.ebitda_multiple_mid}x
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                        Range: {comparison.benchmark.ebitda_multiple_min}x - {comparison.benchmark.ebitda_multiple_max}x
                                    </p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Revenue Multiple</p>
                                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                        {comparison.benchmark.revenue_multiple_mid}x
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                        Range: {comparison.benchmark.revenue_multiple_min}x - {comparison.benchmark.revenue_multiple_max}x
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
                        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BarChart3 size={32} className="text-indigo-400 dark:text-indigo-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white">No Benchmarks Available</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
                            No industry benchmarks available for {report.industry || 'your industry'}.
                            Please update the report industry or contact support.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function formatCurrency(value) {
    if (!value) return '—';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(value);
}