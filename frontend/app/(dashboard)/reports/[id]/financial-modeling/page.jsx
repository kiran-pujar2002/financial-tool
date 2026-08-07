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
    Calculator,
    Building2,
    BarChart3,
    Plus,
    Edit2,
    Trash2,
    Eye,
    Zap,
    X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function FinancialModelingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const reportId = params.id;

    const [report, setReport] = useState(null);
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showScenarioModal, setShowScenarioModal] = useState(false);
    const [modelData, setModelData] = useState(null);

    // New model form
    const [newModelName, setNewModelName] = useState('');
    const [projectionYears, setProjectionYears] = useState(5);

    // Scenario form
    const [scenarioName, setScenarioName] = useState('Base Case');
    const [revenueGrowth, setRevenueGrowth] = useState(10);
    const [ebitdaMargin, setEbitdaMargin] = useState(20);
    const [discountRate, setDiscountRate] = useState(12);
    const [terminalGrowth, setTerminalGrowth] = useState(3);

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

            const response = await api.financialModels.getByReport(reportId);
            setModels(response.models || []);
        } catch (err) {
            console.error('Load error:', err);
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const loadModelDetails = async (modelId) => {
        try {
            const response = await api.financialModels.getModel(modelId);
            setModelData(response.model);
            console.log('Model data:', response.model);
        } catch (err) {
            toast.error('Failed to load model details');
        }
    };

    const createModel = async () => {
        if (!newModelName.trim()) {
            toast.error('Please enter a model name');
            return;
        }

        setIsGenerating(true);
        try {
            const response = await api.financialModels.create({
                reportId,
                name: newModelName,
                projectionYears,
                baseYear: new Date().getFullYear(),
            });

            toast.success('Model created successfully!');
            setShowCreateModal(false);
            setNewModelName('');
            await loadData();
        } catch (err) {
            console.error('Create error:', err);
            toast.error('Failed to create model');
        } finally {
            setIsGenerating(false);
        }
    };

    const createScenario = async (modelId) => {
        try {
            const response = await api.financialModels.createScenario(modelId, {
                name: scenarioName,
                revenueGrowthRate: revenueGrowth,
                ebitdaMargin: ebitdaMargin,
                discountRate: discountRate,
                terminalGrowthRate: terminalGrowth,
                taxRate: 25,
                capexPercentage: 5,
                workingCapitalPercentage: 10,
            });

            toast.success('Scenario created!');
            setShowScenarioModal(false);
            await loadData();
            if (selectedModel) {
                await loadModelDetails(selectedModel.id);
            }
        } catch (err) {
            console.error('Scenario error:', err);
            toast.error('Failed to create scenario');
        }
    };

    const handleSelectModel = async (model) => {
        setSelectedModel(model);
        await loadModelDetails(model.id);
    };

    const formatCurrency = (value) => {
        if (!value) return '—';
        return Number(value).toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        });
    };

    // ✅ Get the first scenario's projections for display
    const getProjections = () => {
        if (!modelData?.scenarios || modelData.scenarios.length === 0) return null;
        return modelData.scenarios[0]?.projections || null;
    };

    const projections = getProjections();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading financial models...</p>
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
                            <h1 className="text-2xl font-bold text-slate-900">Financial Modeling</h1>
                            <p className="text-sm text-slate-500">
                                {report?.business_name || 'Report'} · Projections & Scenarios
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition"
                    >
                        <Plus size={16} />
                        New Model
                    </button>
                </div>

                {/* Create Model Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-900">Create Financial Model</h3>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="p-1 hover:bg-slate-100 rounded-lg transition"
                                >
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Model Name</label>
                                    <input
                                        type="text"
                                        value={newModelName}
                                        onChange={(e) => setNewModelName(e.target.value)}
                                        placeholder="My Projection Model"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Projection Years</label>
                                    <select
                                        value={projectionYears}
                                        onChange={(e) => setProjectionYears(parseInt(e.target.value))}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value={3}>3 Years</option>
                                        <option value={5}>5 Years</option>
                                        <option value={7}>7 Years</option>
                                        <option value={10}>10 Years</option>
                                    </select>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={createModel}
                                        disabled={isGenerating}
                                        className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition disabled:opacity-50"
                                    >
                                        {isGenerating ? 'Creating...' : 'Create Model'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Scenario Modal */}
                {showScenarioModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-900">Create Scenario</h3>
                                <button
                                    onClick={() => setShowScenarioModal(false)}
                                    className="p-1 hover:bg-slate-100 rounded-lg transition"
                                >
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Scenario Name</label>
                                    <input
                                        type="text"
                                        value={scenarioName}
                                        onChange={(e) => setScenarioName(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Revenue Growth Rate (%)</label>
                                    <input
                                        type="number"
                                        value={revenueGrowth}
                                        onChange={(e) => setRevenueGrowth(parseFloat(e.target.value))}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">EBITDA Margin (%)</label>
                                    <input
                                        type="number"
                                        value={ebitdaMargin}
                                        onChange={(e) => setEbitdaMargin(parseFloat(e.target.value))}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowScenarioModal(false)}
                                        className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => createScenario(selectedModel?.id)}
                                        className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition"
                                    >
                                        Create Scenario
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Models List */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left - Models List */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                            <h3 className="font-semibold text-slate-900 mb-3">Your Models</h3>
                            {models.length === 0 ? (
                                <div className="text-center py-8">
                                    <Calculator size={40} className="text-slate-300 mx-auto mb-3" />
                                    <p className="text-sm text-slate-500">No models yet.</p>
                                    <p className="text-xs text-slate-400 mt-1">Create your first financial model.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {models.map((model) => (
                                        <button
                                            key={model.id}
                                            onClick={() => handleSelectModel(model)}
                                            className={`w-full text-left px-3 py-2 rounded-xl transition ${
                                                selectedModel?.id === model.id
                                                    ? 'bg-indigo-50 text-indigo-700'
                                                    : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <p className="font-medium text-sm">{model.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {model.projection_years} years · {new Date(model.created_at).toLocaleDateString()}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right - Model Details */}
                    <div className="lg:col-span-2">
                        {selectedModel ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-slate-900">{selectedModel.name}</h3>
                                    <button
                                        onClick={() => setShowScenarioModal(true)}
                                        className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                    >
                                        <Plus size={14} />
                                        Add Scenario
                                    </button>
                                </div>

                                {/* Scenarios */}
                                <div className="mb-6">
                                    <h4 className="font-medium text-slate-700 mb-3">Scenarios</h4>
                                    {modelData?.scenarios && modelData.scenarios.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {modelData.scenarios.map((scenario) => (
                                                <div key={scenario.id} className="border border-slate-200 rounded-xl p-3 hover:border-indigo-300 transition">
                                                    <p className="font-medium text-sm">{scenario.name}</p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Revenue Growth: {scenario.revenue_growth_rate}%
                                                    </p>
                                                    {scenario.projections && scenario.projections.length > 0 && (
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Year 1 Revenue: {formatCurrency(scenario.projections[0]?.revenue)}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 text-center py-4">
                                            No scenarios yet. Add one to generate projections.
                                        </p>
                                    )}
                                </div>

                                {/* ✅ Projections Preview - DYNAMIC DATA */}
                                <div className="border-t pt-4">
                                    <h4 className="font-medium text-slate-700 mb-3">
                                        {modelData?.projection_years || 5}-Year Projection
                                    </h4>
                                    {projections && projections.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Year</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Revenue</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">EBITDA</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">SDE</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {projections.map((proj) => (
                                                        <tr key={proj.year} className="border-b border-slate-100">
                                                            <td className="px-3 py-2 font-medium">Year {proj.year - new Date().getFullYear()}</td>
                                                            <td className="px-3 py-2 text-right text-emerald-600">
                                                                {formatCurrency(proj.revenue)}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-blue-600">
                                                                {formatCurrency(proj.ebitda)}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-indigo-600">
                                                                {formatCurrency(proj.sde)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 text-center py-4">
                                            No projections yet. Create a scenario to generate projections.
                                        </p>
                                    )}
                                </div>

                                {/* DCF Valuation */}
                                <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500">DCF Valuation</p>
                                            <p className="text-2xl font-bold text-indigo-600">
                                                {formatCurrency(85000000)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500">Discount Rate: 12%</p>
                                            <p className="text-xs text-slate-500">Terminal Growth: 3%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                                <Calculator size={48} className="text-slate-300 mx-auto mb-3" />
                                <h3 className="font-semibold text-slate-900">Select a Model</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Choose a model from the left to view projections and scenarios.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}