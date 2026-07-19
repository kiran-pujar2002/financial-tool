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
  uploaded: { color: 'bg-slate-100 text-slate-700', icon: Clock },
  parsing: { color: 'bg-blue-100 text-blue-700', icon: Clock },
  categorizing: { color: 'bg-amber-100 text-amber-700', icon: Clock },
  ready_for_review: { color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  paid: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  generating_pdf: { color: 'bg-indigo-100 text-indigo-700', icon: Clock },
  completed: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  failed: { color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

function formatCurrency(value) {
  if (value === null) return '—';
  const num = Number(value);
  return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

// ✅ Delete Confirmation Modal
function DeleteModal({ isOpen, onClose, onConfirm, count, isBulk = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
          <AlertTriangle size={28} className="text-red-600" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
          {isBulk ? `Delete ${count} Reports?` : 'Delete Report?'}
        </h3>

        {/* Message */}
        <p className="text-sm text-slate-500 text-center mb-6">
          {isBulk 
            ? `Are you sure you want to move ${count} reports to trash? They can be restored later from the trash page.`
            : 'Are you sure you want to move this report to trash? It can be restored later from the trash page.'
          }
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium text-white transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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

  // ✅ Toggle single report selection
  const toggleSelect = (id) => {
    const newSet = new Set(selectedReports);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedReports(newSet);
  };

  // ✅ Toggle select all
  const toggleSelectAll = () => {
    if (selectedReports.size === reports?.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(reports?.map(r => r.id) || []));
    }
  };

  // ✅ Delete single report
  const handleDeleteSingle = async (id) => {
    setShowDeleteModal(true);
    // Store the ID to delete
    window._deleteTarget = { type: 'single', id };
  };

  // ✅ Delete multiple reports
  const handleDeleteBulk = () => {
    if (selectedReports.size === 0) return;
    setShowDeleteModal(true);
    window._deleteTarget = { type: 'bulk', ids: Array.from(selectedReports) };
  };

  // ✅ Confirm delete
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
          <p className="text-slate-500 text-sm">Loading reports...</p>
        </div>
      </div>
    );
  }

  const totalReports = reports?.length || 0;
  const completedReports = reports?.filter(r => r.status === 'completed').length || 0;
  const processingReports = reports?.filter(r => ['uploaded', 'parsing', 'categorizing'].includes(r.status)).length || 0;
  const isAllSelected = reports?.length > 0 && selectedReports.size === reports.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500 mt-1">
              Every QOE report you&apos;ve started, in progress, or delivered.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* ✅ Bulk Delete Button */}
            {selectedReports.size > 0 && (
              <button
                onClick={handleDeleteBulk}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all duration-200"
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-all duration-200 whitespace-nowrap"
            >
              <Trash2 size={18} />
              Trash
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {reports !== null && reports.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Reports</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{totalReports}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <FileText className="text-indigo-600" size={20} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{completedReports}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="text-emerald-600" size={20} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Processing</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{processingReports}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="text-amber-600" size={20} />
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {reports === null && !error && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
              <p className="text-slate-500 text-sm">Loading reports…</p>
            </div>
          </div>
        )}

        {reports !== null && reports.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="text-indigo-600" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No reports yet</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {/* ✅ Select All Checkbox */}
              <div className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-4">Report</div>
              <div className="col-span-3">Industry</div>
              <div className="col-span-2 text-right">SDE</div>
              <div className="col-span-2 text-right">Status</div>
            </div>

            {/* Report Items */}
            <div className="divide-y divide-slate-200">
              {reports.map((r) => {
                const statusConfig = STATUS_CONFIG[r.status] || STATUS_CONFIG.uploaded;
                const StatusIcon = statusConfig.icon;
                const isSelected = selectedReports.has(r.id);
                
                return (
                  <div
                    key={r.id}
                    className={`block sm:grid sm:grid-cols-12 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    {/* Mobile View */}
                    <div className="sm:hidden flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Mobile Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(r.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{r.business_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">{r.industry || 'Not specified'}</span>
                            <span className="text-xs text-slate-300">·</span>
                            <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm font-medium text-indigo-600 mt-1">
                            SDE: {formatCurrency(r.sde)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon size={12} />
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                        {/* ✅ Mobile Delete Button */}
                        <button
                          onClick={() => handleDeleteSingle(r.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Desktop View */}
                    <div className="hidden sm:flex sm:col-span-1 sm:items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(r.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="hidden sm:flex sm:col-span-4 sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0">
                        <FileText className="text-white" size={16} />
                      </div>
                      <div className="min-w-0">
                        <Link href={`/reports/${r.id}`} className="font-semibold text-sm text-slate-900 hover:text-indigo-600 truncate block">
                          {r.business_name}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="hidden sm:flex sm:col-span-3 sm:items-center">
                      <span className="text-sm text-slate-600 flex items-center gap-1.5">
                        <Building2 size={14} className="text-slate-400" />
                        {r.industry || 'Not specified'}
                      </span>
                    </div>

                    <div className="hidden sm:flex sm:col-span-2 sm:items-center sm:justify-end">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-indigo-600">{formatCurrency(r.sde)}</p>
                      </div>
                    </div>

                    <div className="hidden sm:flex sm:col-span-2 sm:items-center sm:justify-end gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon size={12} />
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                      {/* ✅ Desktop Delete Button */}
                      <button
                        onClick={() => handleDeleteSingle(r.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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

      {/* ✅ Delete Confirmation Modal */}
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