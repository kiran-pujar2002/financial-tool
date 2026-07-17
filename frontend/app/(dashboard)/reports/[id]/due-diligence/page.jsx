'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
    ArrowLeft,
    CheckCircle,
    Circle,
    Clock,
    AlertCircle,
    FileText,
    Upload,
    Download,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    User,
    Calendar,
    Trash2,
    Eye,
    Plus,
    X,
    Filter,
    Search,
    BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DueDiligencePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const reportId = params.id;

    const [report, setReport] = useState(null);
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [selectedItem, setSelectedItem] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Filter states
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

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

            // Get DD progress
            const progressData = await api.dd.getProgress(reportId);
            setItems(progressData.items || []);
            setStats(progressData.stats || {});
        } catch (err) {
            toast.error('Failed to load due diligence data');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const updateItemStatus = async (itemId, status) => {
        setIsUpdating(true);
        try {
            await api.dd.updateProgress(reportId, itemId, { status });
            // Reload data
            await loadData();
            toast.success('Status updated');
        } catch (err) {
            toast.error('Failed to update status');
        } finally {
            setIsUpdating(false);
        }
    };

    const updateItemNotes = async (itemId, notes) => {
        setIsUpdating(true);
        try {
            await api.dd.updateProgress(reportId, itemId, { notes });
            await loadData();
            toast.success('Notes saved');
        } catch (err) {
            toast.error('Failed to save notes');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleFileUpload = async (progressId, file) => {
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            await api.dd.uploadDocument(progressId, formData);
            toast.success('Document uploaded successfully');
            await loadData();
            setShowDocumentModal(false);
        } catch (err) {
            toast.error('Failed to upload document');
        } finally {
            setUploading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <CheckCircle size={18} className="text-emerald-600" />;
            case 'in_progress':
                return <Clock size={18} className="text-amber-600" />;
            case 'blocked':
                return <AlertCircle size={18} className="text-red-600" />;
            default:
                return <Circle size={18} className="text-slate-300" />;
        }
    };

    const getStatusBadge = (status) => {
        const config = {
            completed: 'bg-emerald-100 text-emerald-700',
            in_progress: 'bg-amber-100 text-amber-700',
            blocked: 'bg-red-100 text-red-700',
            pending: 'bg-slate-100 text-slate-600',
        };
        return `px-2 py-0.5 rounded-full text-xs font-medium ${config[status] || config.pending}`;
    };

    const getPriorityBadge = (priority) => {
        const config = {
            high: 'bg-red-100 text-red-700',
            medium: 'bg-amber-100 text-amber-700',
            low: 'bg-blue-100 text-blue-700',
        };
        return `px-2 py-0.5 rounded-full text-xs font-medium ${config[priority] || config.medium}`;
    };

    const toggleCategory = (category) => {
        const newSet = new Set(expandedCategories);
        if (newSet.has(category)) {
            newSet.delete(category);
        } else {
            newSet.add(category);
        }
        setExpandedCategories(newSet);
    };

    // Group items by category
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {});

    // Filter items
    const filteredItems = Object.keys(groupedItems).reduce((acc, category) => {
        const filtered = groupedItems[category].filter(item => {
            const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
            const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 item.description?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesStatus && matchesSearch;
        });
        if (filtered.length > 0) {
            acc[category] = filtered;
        }
        return acc;
    }, {});

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading due diligence checklist...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => router.push(`/reports/${reportId}`)}
                        className="p-2 hover:bg-slate-100 rounded-xl transition"
                    >
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-slate-900">Due Diligence</h1>
                        <p className="text-sm text-slate-500">
                            {report?.business_name || 'Report'} · Track your due diligence progress
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={loadData}
                            className="p-2 hover:bg-slate-100 rounded-xl transition"
                        >
                            <RefreshCw size={18} className="text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 text-center">
                            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 text-center">
                            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Completed</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 text-center">
                            <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">In Progress</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 text-center">
                            <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Blocked</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 text-center">
                            <p className="text-2xl font-bold text-indigo-600">{stats.progressPercentage}%</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Progress</p>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-700">Filter:</span>
                        </div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">All</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="blocked">Blocked</option>
                        </select>
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Checklist */}
                <div className="space-y-4">
                    {Object.keys(filteredItems).length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-slate-200">
                            <FileText size={48} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">No items found</p>
                            <p className="text-sm text-slate-400">Try adjusting your filters</p>
                        </div>
                    ) : (
                        Object.keys(filteredItems).map((category) => (
                            <div key={category} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Category Header */}
                                <button
                                    onClick={() => toggleCategory(category)}
                                    className="w-full flex items-center justify-between px-6 py-3 bg-slate-50 hover:bg-slate-100 transition"
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedCategories.has(category) ? (
                                            <ChevronDown size={18} className="text-slate-500" />
                                        ) : (
                                            <ChevronRight size={18} className="text-slate-500" />
                                        )}
                                        <span className="font-semibold text-slate-900">{category}</span>
                                        <span className="text-xs text-slate-500">
                                            ({filteredItems[category].length} items)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">
                                            {filteredItems[category].filter(i => i.status === 'completed').length}/
                                            {filteredItems[category].length} done
                                        </span>
                                    </div>
                                </button>

                                {/* Category Items */}
                                {expandedCategories.has(category) && (
                                    <div className="divide-y divide-slate-100">
                                        {filteredItems[category].map((item) => (
                                            <div key={item.id} className="px-6 py-4 hover:bg-slate-50/50 transition">
                                                <div className="flex items-start gap-4">
                                                    {/* Status Button */}
                                                    <button
                                                        onClick={() => {
                                                            const nextStatus = {
                                                                pending: 'in_progress',
                                                                in_progress: 'completed',
                                                                completed: 'pending',
                                                                blocked: 'pending'
                                                            };
                                                            updateItemStatus(item.id, nextStatus[item.status] || 'pending');
                                                        }}
                                                        disabled={isUpdating}
                                                        className="mt-0.5 hover:scale-110 transition"
                                                    >
                                                        {getStatusIcon(item.status)}
                                                    </button>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                                            <div>
                                                                <p className="font-medium text-slate-900">{item.title}</p>
                                                                {item.description && (
                                                                    <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <span className={getPriorityBadge(item.priority || item.default_priority)}>
                                                                    {item.priority || item.default_priority || 'medium'}
                                                                </span>
                                                                <span className={getStatusBadge(item.status)}>
                                                                    {item.status}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Notes & Actions */}
                                                        <div className="mt-3 flex flex-wrap items-center gap-3">
                                                            <input
                                                                type="text"
                                                                placeholder="Add notes..."
                                                                defaultValue={item.notes || ''}
                                                                onBlur={(e) => {
                                                                    if (e.target.value !== item.notes) {
                                                                        updateItemNotes(item.id, e.target.value);
                                                                    }
                                                                }}
                                                                className="flex-1 min-w-[150px] px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedItem(item);
                                                                    setShowDocumentModal(true);
                                                                }}
                                                                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                                            >
                                                                <Upload size={14} />
                                                                Upload
                                                            </button>
                                                            {item.documents_count > 0 && (
                                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                    <FileText size={12} />
                                                                    {item.documents_count} files
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Document Upload Modal */}
                {showDocumentModal && selectedItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-900">Upload Document</h3>
                                <button
                                    onClick={() => setShowDocumentModal(false)}
                                    className="p-1 hover:bg-slate-100 rounded-lg transition"
                                >
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            <p className="text-sm text-slate-500 mb-4">
                                {selectedItem.title}
                            </p>
                            <div
                                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={32} className="text-slate-400 mx-auto mb-2" />
                                <p className="text-sm text-slate-600">Click to upload or drag & drop</p>
                                <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, Images (max 10MB)</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            // Need progressId from selected item - we'll get it from the progress
                                            // For now, we'll use a simple approach
                                            handleFileUpload(selectedItem.id, file);
                                        }
                                    }}
                                />
                            </div>
                            {uploading && (
                                <div className="mt-4 text-center">
                                    <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto" />
                                    <p className="text-sm text-slate-500 mt-2">Uploading...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}