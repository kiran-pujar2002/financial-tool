'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl mb-1">Ledger</h1>
          <p className="text-muted text-sm">Sign in to your broker account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-paperRaised border hairline rounded p-6 space-y-4">
          {error && (
            <div className="text-sm text-stamp bg-stamp-light border border-stamp/30 rounded px-3 py-2">
              {error}
            </div>
          )}

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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ledger/40"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ink text-paper rounded py-2 text-sm font-medium hover:bg-ledger-dark transition-colors disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-ledger hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}