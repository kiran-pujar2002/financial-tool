'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b hairline bg-paperRaised">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="font-display text-lg tracking-tight">
          Ledger
        </Link>

        {user && (
          <div className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="text-muted hover:text-ink transition-colors">
              Reports
            </Link>
            <Link href="/dashboard/upload" className="text-muted hover:text-ink transition-colors">
              New report
            </Link>
            <div className="flex items-center gap-3 pl-4 border-l hairline">
              <span className="text-muted">{user.full_name}</span>
              <button onClick={logout} className="text-stamp hover:underline">
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}