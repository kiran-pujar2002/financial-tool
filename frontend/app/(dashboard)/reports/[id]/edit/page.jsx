'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEditorDraft } from '@/hooks/useEditorDraft';
import { TransactionGrid } from '@/components/ReportEditor/TransactionGrid';
import { Dialog, Transition } from '@headlessui/react';
import { 
  ArrowLeft, 
  Save, 
  FileText, 
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Zap,
  AlertTriangle,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const reportId = params.id;

  const {
    report,
    transactions,
    addbacks,
    customCategories,
    isLoading,
    isSaving,
    lastSaved,
    version,
    error,
    updateTransaction,
    bulkUpdate,
    saveDraft,
    finalizeReport,
    reload,
  } = useEditorDraft(reportId);

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Handle finalize
  const handleFinalize = async () => {
    setIsConfirmOpen(false);
    setIsFinalizing(true);
    try {
      await finalizeReport();
      toast.success('Report finalized successfully!');
      router.push(`/reports/${reportId}`);
    } catch (err) {
      toast.error('Failed to finalize report');
    } finally {
      setIsFinalizing(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          <p className="text-slate-500 text-sm">Loading editor...</p>
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
          <p className="text-slate-500 mt-2">The report you're looking for doesn't exist or you don't have access.</p>
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

  const isCompleted = report.status === 'completed';

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/reports/${reportId}`)}
              className="p-2 hover:bg-slate-100 rounded-xl transition"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Edit Report
              </h1>
              <p className="text-sm text-slate-500">
                {report.business_name} · {report.industry || 'No industry specified'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Save Status */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-indigo-600" />
                  <span>Saving...</span>
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle size={14} className="text-emerald-600" />
                  <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>
                </>
              ) : (
                <>
                  <Clock size={14} className="text-slate-400" />
                  <span>Not saved yet</span>
                </>
              )}
            </div>

            {/* Finalize Button */}
            {!isCompleted && (
              <button
                onClick={() => setIsConfirmOpen(true)}
                disabled={isFinalizing || transactions.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
              >
                {isFinalizing ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Finalize Report
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Locked Notice */}
        {isCompleted && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-medium text-amber-700">Report is locked</p>
              <p className="text-sm text-amber-600">This report has been completed and cannot be edited.</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Transactions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  {transactions.length}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  {transactions.filter(t => t.is_manually_edited).length} edited
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  {transactions.filter(t => t.is_addback).length} add-backs
                </span>
              </div>
            </div>

            <TransactionGrid
              transactions={transactions}
              onUpdate={updateTransaction}
              onBulkUpdate={bulkUpdate}
              customCategories={customCategories}
              isCompleted={isCompleted}
              isProcessing={isLoading}
            />
          </div>

          {/* Add-back Summary */}
          {addbacks.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Add-back Summary</h3>
              <div className="space-y-2">
                {addbacks.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-700">{a.label}</span>
                    <span className="text-sm font-medium text-indigo-600">
                      {Number(a.amount).toLocaleString('en-IN', { 
                        style: 'currency', 
                        currency: 'INR', 
                        maximumFractionDigits: 0 
                      })}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t-2 border-slate-200">
                  <span className="font-semibold text-slate-900">Total Add-backs</span>
                  <span className="font-bold text-indigo-600">
                    {Number(report.total_addbacks).toLocaleString('en-IN', { 
                      style: 'currency', 
                      currency: 'INR', 
                      maximumFractionDigits: 0 
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      <Transition appear show={isConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsConfirmOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  {/* Close button */}
                  <button
                    onClick={() => setIsConfirmOpen(false)}
                    className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-lg transition"
                  >
                    <X size={20} className="text-slate-400" />
                  </button>

                  {/* Icon */}
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
                    <AlertTriangle size={28} className="text-red-600" />
                  </div>

                  <Dialog.Title
                    as="h3"
                    className="text-xl font-bold text-slate-900 text-center mb-2"
                  >
                    Finalize Report?
                  </Dialog.Title>

                  <div className="mt-2">
                    <p className="text-sm text-slate-500 text-center">
                      Are you sure you want to finalize this report? You will not be able to edit it after this.
                    </p>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setIsConfirmOpen(false)}
                      disabled={isFinalizing}
                      className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFinalize}
                      disabled={isFinalizing}
                      className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium text-white transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {isFinalizing ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Finalizing...
                        </div>
                      ) : (
                        'Yes, Finalize Report'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}