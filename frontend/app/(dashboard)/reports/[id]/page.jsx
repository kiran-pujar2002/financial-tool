'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link'
import { api, ApiError } from '@/lib/api';
import ShareModal from '@/components/ShareModal';
import { 
  Download, 
  CreditCard, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  Building2,
  Calendar,
  Tag,
  DollarSign,
  Edit2,
  BarChart3,
  ClipboardCheck ,
  Share2 
    
} from 'lucide-react';

const CATEGORIES = [
  'Revenue', 'COGS', 'Payroll', 'Rent', 'Utilities', 'Marketing',
  'Insurance', 'Professional Fees', 'Travel & Entertainment', 'Vehicle',
  'Office Supplies', 'Depreciation & Amortization', 'Interest Expense',
  'Taxes', 'Owner Compensation', 'Other Operating Expense', 'Non-Operating',
];

const PROCESSING_STATUSES = ['uploaded', 'parsing', 'categorizing'];

function money(value) {
  if (value === null) return '—';
  return Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export default function ReportDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const reportId = params.id;

  const [report, setReport] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [addbacks, setAddbacks] = useState([]);
  const [error, setError] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const [showShareModal,setShowShareModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getReport(reportId);
      setReport(data.report);
      setTransactions(data.transactions);
      setAddbacks(data.addbackSchedule);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load report');
    }
  }, [reportId]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  // Poll while the AI pipeline is still running
  useEffect(() => {
    if (!report || !PROCESSING_STATUSES.includes(report.status)) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [report, load]);

  async function toggleAddback(txn) {
    setActionPending(true);
    try {
      const { transaction } = await api.updateTransaction(reportId, txn.id, { isAddback: !txn.is_addback });
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? transaction : t)));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setActionPending(false);
    }
  }

  async function changeCategory(txn, category) {
    setActionPending(true);
    try {
      const { transaction } = await api.updateTransaction(reportId, txn.id, { category });
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? transaction : t)));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setActionPending(false);
    }
  }

  function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
      document.body.appendChild(script);
    });
  }

  async function handlePayment() {
    setActionPending(true);
    setError(null);
    try {
      await loadRazorpayScript();

      const order = await api.createOrder({ type: 'per_report', reportId });

      const razorpayCheckout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: order.name,
        description: order.description,
        prefill: order.prefill,
        theme: { color: '#4F46E5' },
        handler: async (response) => {
          try {
            await api.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await load();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Payment verification failed — please contact support before retrying.');
          } finally {
            setActionPending(false);
          }
        },
        modal: {
          ondismiss: () => {
            setActionPending(false);
          },
        },
      });

      razorpayCheckout.on('payment.failed', (response) => {
        setError(response.error?.description || 'Payment failed. Please try again.');
        setActionPending(false);
      });

      razorpayCheckout.open();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start payment');
      setActionPending(false);
    }
  }

  async function handleGeneratePdf() {
    setActionPending(true);
    setError(null);
    try {
      await api.generatePdf(reportId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Report generation failed');
    } finally {
      setActionPending(false);
    }
  }

  async function handleDownload() {
    setActionPending(true);
    setError(null);
    try {
      const blob = await api.downloadReport(reportId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `QOE-Report-${report.business_name}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Download failed — please try again.');
    } finally {
      setActionPending(false);
    }
  }

  if (authLoading || !user || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          <p className="text-slate-500 text-sm">Loading report...</p>
        </div>
      </div>
    );
  }

  const isProcessing = PROCESSING_STATUSES.includes(report.status);
  const isPaid = report.payment_status === 'paid';
  const isCompleted = report.status === 'completed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <FileText className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{report.business_name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-sm text-slate-500 flex items-center gap-1">
                    <Building2 size={14} />
                    {report.industry || 'Industry not specified'}
                  </span>
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-sm text-slate-500 flex items-center gap-1">
                    <Calendar size={14} />
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <StatusBadge status={report.status} />
                  {isPaid && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                      <CheckCircle size={12} />
                      Paid
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/reports/${report.id}/valuation`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-medium hover:bg-emerald-100 transition"
              >
                <BarChart3 size={16} />
                Valuation
              </Link>
              <Link
                href={`/reports/${report.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition"
              >
                <Edit2 size={16} />
                Edit Report
              </Link>
              <Link
    href={`/reports/${report.id}/due-diligence`}
    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-100 transition"
>
    <ClipboardCheck size={16} />
    Due Diligence
</Link>
<button
    onClick={() => setShowShareModal(true)}
    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 transition"
>
    <Share2 size={16} />
    Share
</button>
              <div className="text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="font-medium">Report ID:</span> #{reportId.slice(0, 8)}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-8 text-center mb-6">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center">
                <RefreshCw className="text-white animate-spin" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  {report.status === 'uploaded' && 'Queued for processing…'}
                  {report.status === 'parsing' && 'Reading your file…'}
                  {report.status === 'categorizing' && 'AI is analyzing your transactions…'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">This usually takes under a minute. This page updates automatically.</p>
              </div>
            </div>
          </div>
        )}

{/* // In the report detail page, update the failed status display */}

{report.status === 'failed' && (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
                <h3 className="font-semibold text-red-700">Processing Failed</h3>
                <p className="text-sm text-red-600 mt-1">
                    {report.error_message?.includes('AI token quota exhausted') ? (
                        <>
                            {report.error_message}
                            <div className="mt-3 space-y-2">
                                <p className="text-sm font-medium">How to fix:</p>
                                <ol className="text-sm list-decimal list-inside space-y-1 text-red-600">
                                    <li>Go to <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google AI Studio</a></li>
                                    <li>Enable billing for your project</li>
                                    <li>Wait 1-2 minutes for the quota to refresh</li>
                                    <li>Upload the report again</li>
                                </ol>
                            </div>
                        </>
                    ) : (
                        report.error_message || 'Try uploading the file again, or contact support if this persists.'
                    )}
                </p>
            </div>
        </div>
    </div>
)}

        {!isProcessing && report.status !== 'failed' && (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <MetricCard 
                label="Revenue" 
                value={money(report.total_revenue)} 
                icon={<TrendingUp size={16} className="text-emerald-600" />}
                color="emerald"
              />
              <MetricCard 
                label="Net Income" 
                value={money(report.net_income)} 
                icon={<TrendingDown size={16} className="text-blue-600" />}
                color="blue"
              />
              <MetricCard 
                label="EBITDA" 
                value={money(report.ebitda)} 
                icon={<TrendingUp size={16} className="text-indigo-600" />}
                color="indigo"
              />
              <MetricCard 
                label="SDE" 
                value={money(report.sde)} 
                highlight 
                icon={<DollarSign size={16} className="text-violet-600" />}
                color="violet"
              />
            </div>

            {/* AI Summary */}
            {report.ai_summary && (
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-6 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="text-white" size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">AI Executive Summary</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{report.ai_summary}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Add-back schedule */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">Add-back Schedule</h2>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    {addbacks.length} items
                  </span>
                </div>
                <Tag size={16} className="text-slate-400" />
              </div>
              {addbacks.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-slate-500">No add-backs currently flagged.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {addbacks.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{a.label}</p>
                        <p className="text-xs text-slate-500">{a.transaction_count} transaction{a.transaction_count !== 1 ? 's' : ''}</p>
                      </div>
                      <p className="text-sm font-semibold text-indigo-600">{money(a.amount)}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-50 to-violet-50">
                    <p className="text-sm font-semibold text-slate-900">Total add-backs</p>
                    <p className="text-lg font-bold text-indigo-600">{money(report.total_addbacks)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                      {transactions.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {isCompleted ? '🔒 Locked on completed reports' : '✏️ Edits update totals immediately'}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Add-back</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {transactions.map((t) => (
                      <tr key={t.id} className={t.is_addback ? 'bg-indigo-50/30' : 'hover:bg-slate-50 transition'}>
                        <td className="px-4 py-3 text-slate-900">{t.description}</td>
                        <td className="px-4 py-3">
                          <select
                            value={t.category}
                            disabled={isCompleted || actionPending}
                            onChange={(e) => changeCategory(t, e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white disabled:opacity-60 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{money(t.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={t.is_addback}
                            disabled={isCompleted || actionPending}
                            onChange={() => toggleAddback(t)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========== ACTION CARD - FIXED (Only one section) ========== */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Left side - Status message */}
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {isCompleted ? '✅ Report is ready' : isPaid ? '💰 Payment received' : '💳 Ready to unlock'}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {isCompleted
                      ? 'Download the final PDF report below.'
                      : isPaid
                      ? 'Generate the final PDF whenever you\'re ready.'
                      : `Review add-backs above, then pay ₹${Number(report.price || 42415).toLocaleString()} to unlock the final PDF.`}
                  </p>
                </div>

                {/* Right side - Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Main Action Button */}
                  {isCompleted ? (
                    <button
                      onClick={handleDownload}
                      disabled={actionPending}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                    >
                      {actionPending ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Downloading…
                        </>
                      ) : (
                        <>
                          <Download size={18} />
                          Download PDF
                        </>
                      )}
                    </button>
                  ) : isPaid ? (
                    <button
                      onClick={handleGeneratePdf}
                      disabled={actionPending}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                    >
                      {actionPending ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <FileText size={18} />
                          Generate Report
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handlePayment}
                      disabled={actionPending}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                    >
                      {actionPending ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Processing…
                        </>
                      ) : (
                        <>
                          <CreditCard size={18} />
                          Pay & Unlock Report
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  )}
                  <ShareModal
    isOpen={showShareModal}
    onClose={() => setShowShareModal(false)}
    reportId={reportId}
/>

                  {/* CIM Report Button */}
                  <Link
                    href={`/reports/${report.id}/cim`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-medium hover:bg-emerald-100 transition border border-emerald-200"
                  >
                    <FileText size={16} />
                    CIM Report
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, highlight, icon, color = 'indigo' }) {
  const colorMap = {
    emerald: 'border-emerald-200 bg-emerald-50',
    blue: 'border-blue-200 bg-blue-50',
    indigo: 'border-indigo-200 bg-indigo-50',
    violet: 'border-violet-200 bg-violet-50',
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-all duration-200 ${highlight ? 'border-violet-300 ring-1 ring-violet-300' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        {icon}
      </div>
      <p className={`text-xl font-bold ${highlight ? 'text-violet-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    uploaded: { label: 'Uploaded', icon: Clock, color: 'bg-slate-100 text-slate-700' },
    parsing: { label: 'Parsing', icon: RefreshCw, color: 'bg-blue-100 text-blue-700' },
    categorizing: { label: 'Analyzing', icon: RefreshCw, color: 'bg-indigo-100 text-indigo-700' },
    ready_for_review: { label: 'Needs Review', icon: AlertCircle, color: 'bg-amber-100 text-amber-700' },
    paid: { label: 'Paid', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
    generating_pdf: { label: 'Generating', icon: RefreshCw, color: 'bg-indigo-100 text-indigo-700' },
    completed: { label: 'Complete', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
    failed: { label: 'Failed', icon: AlertCircle, color: 'bg-red-100 text-red-700' },
  };

  const { label, icon: Icon, color } = config[status] || config.uploaded;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}