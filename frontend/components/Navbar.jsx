'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

import {
  LayoutDashboard,
  Upload,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Landmark,
  Menu,
  X,
  Palette, // ✅ Added Palette import
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Upload Report',
      href: '/dashboard/upload',
      icon: Upload,
    },
  ];

  const isActive = (href) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  // Get initials from user name
  const getInitials = (fullName) => {
    if (!fullName) return 'U';
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm">
      <div className="mx-auto h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Logo - Left */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 flex-shrink-0"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg">
            <Landmark className="text-white" size={20} />
          </div>

          <div className="hidden sm:block">
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              Ledger AI
            </h1>
            <p className="text-xs text-slate-500 leading-tight">
              Financial Restatement
            </p>
          </div>
        </Link>

        {user && (
          <>
            {/* Navigation - Center */}
            <nav className="hidden md:flex items-center gap-2 flex-1 justify-center">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                      active
                        ? 'text-indigo-600 bg-indigo-50'
                        : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={19} className={active ? 'text-indigo-600' : 'text-slate-500'} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right side - Mobile menu + Avatar */}
            <div className="flex items-center gap-2">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              {/* Profile Avatar - Only Avatar with dropdown */}
              <div className="relative flex-shrink-0" ref={dropdownRef}>
                <button
                  onClick={() => setOpen(!open)}
                  className="flex items-center gap-1 px-2 py-2 rounded-full hover:bg-slate-50 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {getInitials(user.full_name)}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-300 ${
                      open ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {open && (
                  <div className="absolute right-0 mt-3 w-72 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    
                    {/* Header */}
                    <div className="p-5 border-b">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                          {getInitials(user.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {user.full_name}
                          </h3>
                          <p className="text-sm text-slate-500 truncate">
                            {user.email}
                          </p>
                          <span className="inline-flex mt-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                            Broker
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        href="/profile"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition"
                      >
                        <User size={18} className="text-slate-500" />
                        <span>My Profile</span>
                      </Link>

                      <Link
                        href="/dashboard/settings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition"
                      >
                        <Settings size={18} className="text-slate-500" />
                        <span>Settings</span>
                      </Link>

                      {/* ✅ Branding Link */}
                      <Link
                        href="/settings/branding"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition"
                      >
                        <Palette size={18} className="text-slate-500" />
                        <span>Branding</span>
                      </Link>
                    </div>

                    {/* Logout */}
                    <div className="border-t">
                      <button
                        onClick={() => {
                          setOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-3 px-5 py-4 text-red-600 hover:bg-red-50 transition"
                      >
                        <LogOut size={18} />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && user && (
        <div className="md:hidden bg-white border-b border-slate-200 shadow-lg animate-in slide-in-from-top duration-200">
          <nav className="px-4 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    active
                      ? 'text-indigo-600 bg-indigo-50'
                      : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={20} className={active ? 'text-indigo-600' : 'text-slate-500'} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}