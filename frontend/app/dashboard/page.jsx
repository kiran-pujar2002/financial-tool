'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Navbar from '@/components/Navbar';

const STATUS_LABEL = {
  uploaded: 'Uploaded',
  parsing: 'Parsing',
  categorizing: 'Analyzing',
  ready_for_review: 'Needs review',
  paid: 'Paid',
  generating_pdf: 'Generating',
  completed: 'Complete',
  failed: 'Failed',
};

const STATUS_COLOR = {
  uploaded: 'text-muted',
  parsing: 'text-muted',
  categorizing: 'text-flag',
  ready_for_review: 'text-flag',
  paid: 'text-ledger',
  generating_pdf: 'text-ledger',
  completed: 'text-ledger',
  failed: 'text-stamp',
};

function formatCurrency(value) {
  if (value === null) return '—';
  const num = Number(value);
  return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.listReports()
      .then(({ reports }) => setReports(reports))
      .catch((err) => setError(err.message || 'Failed to load reports'));
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl">Reports</h1>
            <p className="text-muted text-sm mt-1">Every QOE report you&apos;ve started, in progress, or delivered.</p>
          </div>
          <Link
            href="/dashboard/upload"
            className="bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ledger-dark transition-colors"
          >
            + New report
          </Link>
        </div>

        {error && (
          <div className="text-sm text-stamp bg-stamp-light border border-stamp/30 rounded px-3 py-2 mb-6">
            {error}
          </div>
        )}

        {reports === null && !error && (
          <p className="text-muted text-sm">Loading reports…</p>
        )}

        {reports !== null && reports.length === 0 && (
          <div className="border hairline rounded bg-paperRaised p-10 text-center">
            <p className="font-display text-lg mb-1">No reports yet</p>
            <p className="text-muted text-sm mb-5">Upload a financial statement to generate your first QOE report.</p>
            <Link
              href="/dashboard/upload"
              className="inline-block bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ledger-dark transition-colors"
            >
              Upload financials
            </Link>
          </div>
        )}

        {reports !== null && reports.length > 0 && (
          <div className="border hairline rounded bg-paperRaised divide-y hairline">
            {reports.map((r) => (
              <Link
                key={r.id}
                href={`/reports/${r.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-paper transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{r.business_name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {r.industry || 'Industry not specified'} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-[10px] text-muted uppercase tracking-wide">SDE</p>
                    <p className="ledger-num text-sm">{formatCurrency(r.sde)}</p>
                  </div>
                  <span className={`stamp ${STATUS_COLOR[r.status] || 'text-muted'}`}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}