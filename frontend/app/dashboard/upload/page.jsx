'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import Navbar from '@/components/Navbar';

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !user) {
    router.replace('/login');
    return null;
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Please select a financial statement file (CSV or Excel).');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('businessName', businessName);
    if (industry) formData.append('industry', industry);
    if (periodStart) formData.append('periodStart', periodStart);
    if (periodEnd) formData.append('periodEnd', periodEnd);

    setSubmitting(true);
    try {
      const { report } = await api.uploadReport(formData);
      router.push(`/reports/${report.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-2xl mb-1">New report</h1>
        <p className="text-muted text-sm mb-8">
          Upload a CSV or Excel export of the business&apos;s P&amp;L. We&apos;ll categorize every line item and flag likely add-backs automatically.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="text-sm text-stamp bg-stamp-light border border-stamp/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="businessName">Business name</label>
            <input
              id="businessName"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full border hairline rounded px-3 py-2 text-sm bg-paperRaised focus:outline-none focus:ring-2 focus:ring-ledger/40"
              placeholder="Acme Hardware LLC"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="industry">Industry (optional)</label>
              <input
                id="industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full border hairline rounded px-3 py-2 text-sm bg-paperRaised focus:outline-none focus:ring-2 focus:ring-ledger/40"
                placeholder="Retail / Hardware"
              />
            </div>
            <div />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="periodStart">Period start (optional)</label>
              <input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full border hairline rounded px-3 py-2 text-sm bg-paperRaised focus:outline-none focus:ring-2 focus:ring-ledger/40"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="periodEnd">Period end (optional)</label>
              <input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full border hairline rounded px-3 py-2 text-sm bg-paperRaised focus:outline-none focus:ring-2 focus:ring-ledger/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Financial statement</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded px-6 py-10 text-center cursor-pointer transition-colors ${
                dragActive ? 'border-ledger bg-ledger-light' : 'border-line bg-paperRaised'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted mt-1">{(file.size / 1024).toFixed(0)} KB — click to replace</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">Drag and drop, or click to browse</p>
                  <p className="text-xs text-muted mt-1">CSV or Excel (.xlsx, .xls), up to 25MB</p>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ink text-paper rounded py-2.5 text-sm font-medium hover:bg-ledger-dark transition-colors disabled:opacity-50"
          >
            {submitting ? 'Uploading…' : 'Upload and analyze'}
          </button>
        </form>
      </main>
    </div>
  );
}