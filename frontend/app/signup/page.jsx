'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

export default function SignupPage() {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup({ email, password, fullName, companyName: companyName || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl mb-1">Ledger</h1>
          <p className="text-muted text-sm">Create your broker account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-paperRaised border hairline rounded p-6 space-y-4">
          {error && (
            <div className="text-sm text-stamp bg-stamp-light border border-stamp/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ledger/40"
              placeholder="Jordan Reyes"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="companyName">Brokerage (optional)</label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ledger/40"
              placeholder="Reyes M&A Advisors"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ledger/40"
              placeholder="you@brokerage.com"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ledger/40"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ink text-paper rounded py-2 text-sm font-medium hover:bg-ledger-dark transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-ledger hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}