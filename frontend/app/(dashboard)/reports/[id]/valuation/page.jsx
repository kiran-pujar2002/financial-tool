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
    CheckCircle,
    RefreshCw,
    Download,
    Calculator,
    Building2,
    BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ValuationPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const reportId = params.id;

    const [report, setReport] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCalculating, setIsCalculating] = useState(false);
    const [valuation, setValuation] = useState(null);
    const [valuationHistory, setValuationHistory] = useState([]);
    const [industryMultiples, setIndustryMultiples] = useState([]);
    
    // Form state
    const [method, setMethod] = useState('sde');
    const [customMultiple, setCustomMultiple] = useState(3.0);
    const [useCustomMultiple, setUseCustomMultiple] = useState(false);
    const [riskFactors, setRiskFactors] = useState([]);

    // Load data
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
            // Get report
            const reportData = await api.getReport(reportId);
            setReport(reportData.report);
            setTransactions(reportData.transactions);
            
            // ✅ Get industry multiples using new API structure
            const multiplesData = await api.valuation.getMultiples();
            setIndustryMultiples(multiplesData.multiples);
            
            // ✅ Get valuation history using new API structure
            const historyData = await api.valuation.getHistory(reportId);
            setValuationHistory(historyData.history || []);
            
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle valuation calculation
    const handleCalculate = async () => {
        setIsCalculating(true);
        try {
            const multiple = useCustomMultiple ? customMultiple : null;
            // ✅ Calculate valuation using new API structure
            const result = await api.valuation.calculate({
                reportId,
                method,
                multiple,
                riskFactors
            });
            setValuation(result.valuation);
            setValuationHistory(prev => [result.valuation, ...prev]);
            toast.success('✅ Valuation calculated successfully!');
        } catch (err) {
            toast.error('❌ Failed to calculate valuation');
        } finally {
            setIsCalculating(false);
        }
    };

    // ✅ Handle download
    const handleDownload = async () => {
        if (!valuation) {
            toast.error('Please calculate a valuation first');
            return;
        }
        
        try {
            toast.loading('Generating valuation report...');
            // ✅ Generate report using new API structure
            const response = await api.valuation.generateReport({
                reportId: reportId,
                valuationId: valuation.id
            });
            
            // Download the file
            window.open(response.downloadUrl, '_blank');
            toast.dismiss();
            toast.success('📊 Valuation report downloaded successfully!');
        } catch (err) {
            toast.dismiss();
            toast.error('Failed to generate valuation report');
            console.error(err);
        }
    };

    // Format currency
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
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading valuation data...</p>
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
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push(`/reports/${reportId}`)}
                        className="p-2 hover:bg-slate-100 rounded-xl transition"
                    >
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Business Valuation</h1>
                        <p className="text-sm text-slate-500">
                            {report.business_name} · {report.industry || 'Industry not specified'}
                        </p>
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Revenue</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">
                            {formatCurrency(report.total_revenue)}
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">EBITDA</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">
                            {formatCurrency(report.ebitda)}
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">SDE</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">
                            {formatCurrency(report.sde)}
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Add-backs</p>
                        <p className="text-lg font-bold text-emerald-600 mt-1">
                            {formatCurrency(report.total_addbacks)}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left - Valuation Calculator */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Valuation Method */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Valuation Method</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {['sde', 'ebitda', 'revenue'].map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setMethod(m)}
                                        className={`p-3 rounded-xl border-2 transition ${
                                            method === m
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <p className="font-medium text-sm capitalize">{m}</p>
                                        <p className="text-xs text-slate-500">
                                            {m === 'sde' ? 'SDE Multiple' :
                                             m === 'ebitda' ? 'EBITDA Multiple' :
                                             'Revenue Multiple'}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            {/* Multiple Selection */}
                            <div className="mt-4">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={useCustomMultiple}
                                        onChange={(e) => setUseCustomMultiple(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Use custom multiple
                                </label>
                                {useCustomMultiple && (
                                    <div className="mt-2">
                                        <input
                                            type="number"
                                            value={customMultiple}
                                            onChange={(e) => setCustomMultiple(parseFloat(e.target.value))}
                                            step="0.1"
                                            min="0.5"
                                            max="20"
                                            className="w-32 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <span className="ml-2 text-sm text-slate-500">x</span>
                                    </div>
                                )}
                            </div>

                            {/* Industry Multiple Suggestion */}
                            {industryMultiples.length > 0 && report.industry && (
                                <div className="mt-4 p-3 bg-slate-50 rounded-xl">
                                    <p className="text-xs text-slate-500">Industry Suggestion</p>
                                    <p className="text-sm font-medium text-slate-900">
                                        {report.industry}: {
                                            method === 'sde' ? 
                                                `${industryMultiples[0].sde_multiple_mid}x` :
                                            method === 'ebitda' ?
                                                `${industryMultiples[0].ebitda_multiple_mid}x` :
                                                `${industryMultiples[0].revenue_multiple_mid || 1.0}x`
                                        }
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Risk Factors */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Adjustments</h3>
                            <div className="space-y-2">
                                {[
                                    { id: 'customer_concentration', name: 'Customer Concentration', desc: 'High dependency on few customers', factor: 0.05 },
                                    { id: 'supplier_concentration', name: 'Supplier Concentration', desc: 'High dependency on few suppliers', factor: 0.05 },
                                    { id: 'industry_risk', name: 'Industry Risk', desc: 'Cyclical or declining industry', factor: 0.10 },
                                    { id: 'management_risk', name: 'Management Risk', desc: 'Key person dependency', factor: 0.10 },
                                    { id: 'competitive_risk', name: 'Competitive Risk', desc: 'High competition or low barriers', factor: 0.05 },
                                ].map((risk) => (
                                    <label key={risk.id} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg transition cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={riskFactors.some(r => r.id === risk.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setRiskFactors([...riskFactors, risk]);
                                                } else {
                                                    setRiskFactors(riskFactors.filter(r => r.id !== risk.id));
                                                }
                                            }}
                                            className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{risk.name}</p>
                                            <p className="text-xs text-slate-500">{risk.desc}</p>
                                            <p className="text-xs text-red-600">-{risk.factor * 100}% adjustment</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Calculate Button */}
                        <button
                            onClick={handleCalculate}
                            disabled={isCalculating}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isCalculating ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Calculating...
                                </>
                            ) : (
                                <>
                                    <Calculator size={18} />
                                    Calculate Valuation
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right - Valuation Result */}
                    <div className="lg:col-span-1">
                        {valuation ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
                                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Valuation Result</h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs text-slate-500">Selected Value</p>
                                        <p className="text-3xl font-bold text-indigo-600">
                                            {formatCurrency(valuation.selected_value)}
                                        </p>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-slate-50 rounded-xl p-2 text-center">
                                            <p className="text-[10px] text-slate-500">Low</p>
                                            <p className="text-sm font-semibold text-slate-700">
                                                {formatCurrency(valuation.value_min)}
                                            </p>
                                        </div>
                                        <div className="bg-indigo-50 rounded-xl p-2 text-center border-2 border-indigo-200">
                                            <p className="text-[10px] text-indigo-600 font-medium">Mid</p>
                                            <p className="text-sm font-bold text-indigo-700">
                                                {formatCurrency(valuation.value_mid)}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-2 text-center">
                                            <p className="text-[10px] text-slate-500">High</p>
                                            <p className="text-sm font-semibold text-slate-700">
                                                {formatCurrency(valuation.value_max)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-slate-200">
                                        <p className="text-xs text-slate-500">Method</p>
                                        <p className="text-sm font-medium capitalize">
                                            {valuation.method} Multiple: {valuation.multiple_used}x
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleDownload}
                                        disabled={!valuation}
                                        className="w-full py-2 border border-indigo-200 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Download size={16} />
                                        Download Report
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
                                <BarChart3 size={48} className="text-slate-300 mx-auto mb-3" />
                                <h3 className="font-semibold text-slate-900">No Valuation Yet</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Configure the valuation settings and click calculate.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}