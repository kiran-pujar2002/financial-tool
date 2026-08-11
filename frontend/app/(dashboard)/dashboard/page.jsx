'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { 
  Plus, 
  FileText, 
  AlertCircle, 
  Clock,
  CheckCircle,
  TrendingUp,
  Building2,
  Calendar,
  ArrowRight,
  Trash2,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_LABEL = {
  uploaded: 'Uploaded',
  parsing: 'Parsing',
  categorizing: 'Analyzing',
  ready_for_review: 'Needs Review',
  paid: 'Paid',
  generating_pdf: 'Generating',
  completed: 'Complete',
  failed: 'Failed',
};

const STATUS_CONFIG = {
  uploaded: { color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300', icon: Clock },
  parsing: { color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300', icon: Clock },
  categorizing: { color: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300', icon: Clock },
  ready_for_review: { color: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300', icon: AlertCircle },
  paid: { color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300', icon: CheckCircle },
  generating_pdf: { color: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300', icon: Clock },
  completed: { color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300', icon: CheckCircle },
  failed: { color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300', icon: AlertCircle },
};

function formatCurrency(value) {
  if (value === null) return '—';
  const num = Number(value);
  return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

// Delete Confirmation Modal
function DeleteModal({ isOpen, onClose, onConfirm, count, isBulk = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
          <AlertTriangle size={28} className="text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-2">
          {isBulk ? `Delete ${count} Reports?` : 'Delete Report?'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
          {isBulk 
            ? `Are you sure you want to move ${count} reports to trash? They can be restored later from the trash page.`
            : 'Are you sure you want to move this report to trash? It can be restored later from the trash page.'
          }
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium text-white transition"
          >
            Move to Trash
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [selectedReports, setSelectedReports] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    loadReports();
  }, [user]);

  const loadReports = async () => {
    try {
      const { reports } = await api.listReports();
      setReports(reports);
    } catch (err) {
      setError(err.message || 'Failed to load reports');
    }
  };

  const toggleSelect = (id) => {
    const newSet = new Set(selectedReports);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedReports(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedReports.size === reports?.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(reports?.map(r => r.id) || []));
    }
  };

  const handleDeleteSingle = (id) => {
    setShowDeleteModal(true);
    window._deleteTarget = { type: 'single', id };
  };

  const handleDeleteBulk = () => {
    if (selectedReports.size === 0) return;
    setShowDeleteModal(true);
    window._deleteTarget = { type: 'bulk', ids: Array.from(selectedReports) };
  };

  const confirmDelete = async () => {
    const target = window._deleteTarget;
    if (!target) return;

    setIsDeleting(true);
    try {
      if (target.type === 'single') {
        await api.deleteReport(target.id);
        toast.success('Report moved to trash');
      } else if (target.type === 'bulk') {
        await Promise.all(target.ids.map(id => api.deleteReport(id)));
        toast.success(`${target.ids.length} reports moved to trash`);
        setSelectedReports(new Set());
      }
      await loadReports();
    } catch (err) {
      toast.error('Failed to delete reports');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      window._deleteTarget = null;
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading reports...</p>
        </div>
      </div>
    );
  }

  const totalReports = reports?.length || 0;
  const completedReports = reports?.filter(r => r.status === 'completed').length || 0;
  const processingReports = reports?.filter(r => ['uploaded', 'parsing', 'categorizing'].includes(r.status)).length || 0;
  const isAllSelected = reports?.length > 0 && selectedReports.size === reports.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/30">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Reports</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Every QOE report you&apos;ve started, in progress, or delivered.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {selectedReports.size > 0 && (
              <button
                onClick={handleDeleteBulk}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-all duration-200"
              >
                <Trash2 size={18} />
                Delete Selected ({selectedReports.size})
              </button>
            )}
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all duration-200 whitespace-nowrap"
            >
              <Plus size={18} />
              New Report
            </Link>
            <Link
              href="/dashboard/trash"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-all duration-200 whitespace-nowrap"
            >
              <Trash2 size={18} />
              Trash
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {reports !== null && reports.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Reports</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalReports}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                  <FileText className="text-indigo-600 dark:text-indigo-400" size={20} />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{completedReports}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={20} />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Processing</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{processingReports}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <Clock className="text-amber-600 dark:text-amber-400" size={20} />
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {reports === null && !error && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Loading reports…</p>
            </div>
          </div>
        )}

        {reports !== null && reports.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mx-auto mb-4">
              <FileText className="text-indigo-600 dark:text-indigo-400" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No reports yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Upload a financial statement to generate your first QOE report.
            </p>
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all duration-200"
            >
              Upload Financials
              <ArrowRight size={18} />
            </Link>
          </div>
        )}

        {reports !== null && reports.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <div className="col-span-1 flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-4">Report</div>
              <div className="col-span-2">Industry</div>
              <div className="col-span-2 text-right">SDE</div>
              <div className="col-span-2 text-right">Status</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {/* Report Items */}
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {reports.map((r) => {
                const statusConfig = STATUS_CONFIG[r.status] || STATUS_CONFIG.uploaded;
                const StatusIcon = statusConfig.icon;
                const isSelected = selectedReports.has(r.id);
                
                return (
                  <div
                    key={r.id}
                    className={`block sm:grid sm:grid-cols-12 sm:gap-2 px-4 sm:px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''
                    }`}
                  >
                    {/* Mobile View */}
                    <div className="sm:hidden flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(r.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <Link 
                            href={`/reports/${r.id}`}
                            className="font-semibold text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                          >
                            {r.business_name}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">{r.industry || 'Not specified'}</span>
                            <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                            SDE: {formatCurrency(r.sde)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon size={12} />
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                        <button
                          onClick={() => handleDeleteSingle(r.id)}
                          className="p-1.5 text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Desktop View */}
                    <div className="hidden sm:flex sm:col-span-1 sm:items-center sm:justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(r.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="hidden sm:flex sm:col-span-4 sm:items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0">
                        <FileText className="text-white" size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/reports/${r.id}`} className="font-medium text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate block">
                          {r.business_name}
                        </Link>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="hidden sm:flex sm:col-span-2 sm:items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5">
                        <Building2 size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                        {r.industry || 'Not specified'}
                      </span>
                    </div>

                    <div className="hidden sm:flex sm:col-span-2 sm:items-center sm:justify-end">
                      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(r.sde)}
                      </span>
                    </div>

                    <div className="hidden sm:flex sm:col-span-2 sm:items-center sm:justify-end">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon size={12} />
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </div>

                    <div className="hidden sm:flex sm:col-span-1 sm:items-center sm:justify-center">
                      <button
                        onClick={() => handleDeleteSingle(r.id)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                        title="Delete report"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          window._deleteTarget = null;
        }}
        onConfirm={confirmDelete}
        count={window._deleteTarget?.type === 'bulk' ? window._deleteTarget.ids?.length : 1}
        isBulk={window._deleteTarget?.type === 'bulk'}
      />
    </div>
  );
}