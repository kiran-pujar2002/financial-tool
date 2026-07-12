'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import Navbar from '@/components/Navbar';

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

  async function handlePayment() {
    setActionPending(true);
    setError(null);
    try {
      const { checkoutUrl } = await api.checkout({ type: 'per_report', reportId });
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout');
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

  if (authLoading || !user || !report) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Loading…</div>;
  }

  const isProcessing = PROCESSING_STATUSES.includes(report.status);
  const isPaid = report.payment_status === 'paid';
  const isCompleted = report.status === 'completed';

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl">{report.business_name}</h1>
            <p className="text-muted text-sm mt-1">{report.industry || 'Industry not specified'}</p>
          </div>
          <StatusStamp status={report.status} />
        </div>

        {error && (
          <div className="text-sm text-stamp bg-stamp-light border border-stamp/30 rounded px-3 py-2 mb-6">
            {error}
          </div>
        )}

        {isProcessing && (
          <div className="border hairline rounded bg-paperRaised p-8 text-center mb-8">
            <p className="font-medium text-sm mb-1">
              {report.status === 'uploaded' && 'Queued for processing…'}
              {report.status === 'parsing' && 'Reading your file…'}
              {report.status === 'categorizing' && 'AI is categorizing transactions and flagging add-backs…'}
            </p>
            <p className="text-muted text-xs">This usually takes under a minute. This page updates automatically.</p>
          </div>
        )}

        {report.status === 'failed' && (
          <div className="border border-stamp/30 rounded bg-stamp-light p-6 mb-8">
            <p className="text-sm text-stamp font-medium">Processing failed</p>
            <p className="text-xs text-stamp/80 mt-1">Try uploading the file again, or contact support if this persists.</p>
          </div>
        )}

        {!isProcessing && report.status !== 'failed' && (
          <>
            <div className="grid grid-cols-4 gap-3 mb-8">
              <MetricCard label="Revenue" value={money(report.total_revenue)} />
              <MetricCard label="Net Income" value={money(report.net_income)} />
              <MetricCard label="EBITDA" value={money(report.ebitda)} />
              <MetricCard label="SDE" value={money(report.sde)} highlight />
            </div>

            {report.ai_summary && (
              <div className="border hairline rounded bg-paperRaised p-5 mb-8">
                <p className="text-xs text-muted uppercase tracking-wide mb-2">Executive summary</p>
                <p className="text-sm leading-relaxed">{report.ai_summary}</p>
              </div>
            )}

            <div className="mb-8">
              <h2 className="font-display text-lg mb-3">Add-back schedule</h2>
              {addbacks.length === 0 ? (
                <p className="text-sm text-muted">No add-backs currently flagged.</p>
              ) : (
                <div className="border hairline rounded bg-paperRaised divide-y hairline">
                  {addbacks.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div>
                        <p>{a.label}</p>
                        <p className="text-xs text-muted">{a.transaction_count} transaction{a.transaction_count !== 1 ? 's' : ''}</p>
                      </div>
                      <p className="ledger-num">{money(a.amount)}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 text-sm font-medium bg-paper">
                    <p>Total add-backs</p>
                    <p className="ledger-num">{money(report.total_addbacks)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg">Transactions</h2>
                <p className="text-xs text-muted">
                  Review AI categorization before paying — {isCompleted ? 'locked on completed reports' : 'edits update totals immediately'}
                </p>
              </div>
              <div className="border hairline rounded bg-paperRaised overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b hairline text-left text-xs text-muted uppercase tracking-wide">
                      <th className="px-4 py-2 font-medium">Description</th>
                      <th className="px-4 py-2 font-medium">Category</th>
                      <th className="px-4 py-2 font-medium text-right">Amount</th>
                      <th className="px-4 py-2 font-medium text-center">Add-back</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y hairline">
                    {transactions.map((t) => (
                      <tr key={t.id} className={t.is_addback ? 'bg-flag-light/40' : ''}>
                        <td className="px-4 py-2">{t.description}</td>
                        <td className="px-4 py-2">
                          <select
                            value={t.category}
                            disabled={isCompleted || actionPending}
                            onChange={(e) => changeCategory(t, e.target.value)}
                            className="border hairline rounded px-2 py-1 text-xs bg-paperRaised disabled:opacity-60"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right ledger-num">{money(t.amount)}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={t.is_addback}
                            disabled={isCompleted || actionPending}
                            onChange={() => toggleAddback(t)}
                            className="accent-ledger"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border hairline rounded bg-paperRaised p-6 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {isCompleted ? 'Report is ready' : isPaid ? 'Payment received' : 'Report price: ₹42,415'}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {isCompleted
                    ? 'Download the final PDF below.'
                    : isPaid
                    ? 'Generate the final PDF whenever you\u2019re ready.'
                    : 'Review add-backs above, then pay to unlock the final PDF.'}
                </p>
              </div>

              {isCompleted ? (
                <a
                  href={api.downloadUrl(reportId)}
                  className="bg-ledger text-white rounded px-4 py-2 text-sm font-medium hover:bg-ledger-dark transition-colors"
                >
                  Download PDF
                </a>
              ) : isPaid ? (
                <button
                  onClick={handleGeneratePdf}
                  disabled={actionPending}
                  className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ledger-dark transition-colors disabled:opacity-50"
                >
                  {actionPending ? 'Generating…' : 'Generate report'}
                </button>
              ) : (
                <button
                  onClick={handlePayment}
                  disabled={actionPending}
                  className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ledger-dark transition-colors disabled:opacity-50"
                >
                  {actionPending ? 'Redirecting…' : 'Pay & unlock report'}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, highlight }) {
  return (
    <div className={`border hairline rounded p-4 ${highlight ? 'bg-ledger-light' : 'bg-paperRaised'}`}>
      <p className="text-[10px] text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`ledger-num text-lg ${highlight ? 'text-ledger-dark' : ''}`}>{value}</p>
    </div>
  );
}

function StatusStamp({ status }) {
  const label = {
    uploaded: 'Uploaded', parsing: 'Parsing', categorizing: 'Analyzing',
    ready_for_review: 'Needs review', paid: 'Paid', generating_pdf: 'Generating',
    completed: 'Complete', failed: 'Failed',
  };
  const color = {
    ready_for_review: 'text-flag', paid: 'text-ledger', generating_pdf: 'text-ledger',
    completed: 'text-ledger', failed: 'text-stamp',
  };
  return <span className={`stamp ${color[status] || 'text-muted'}`}>{label[status] || status}</span>;
}