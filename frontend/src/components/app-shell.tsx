'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { BrandWordmark, Button, Badge } from './ui';
import {
  LayoutDashboard,
  User,
  Shield,
  Layers,
  LogOut,
  Menu,
  X,
  ExternalLink,
  CheckCircle2,
  FileText,
  CheckSquare,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
}

export default function AppShell({ children, headerTitle, headerSubtitle }: AppShellProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'DASHBOARD', href: '/dashboard', icon: LayoutDashboard },
    { label: 'DOCUMENTS', href: '/documents', icon: FileText },
    { label: 'TASKS', href: '/tasks', icon: CheckSquare },
    { label: 'PROFILE', href: '/settings/profile', icon: User },
    { label: 'SECURITY', href: '/settings/security', icon: Shield },
    { label: 'SESSIONS', href: '/settings/sessions', icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-[#FAFAFA] flex flex-col selection:bg-[#FAFAFA] selection:text-[#111111]">
      {/* ─── Top Global Navigation ─── */}
      <header className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur-md border-b border-[#2D2D2D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Left: Brand & Telemetry */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="transition-opacity hover:opacity-85">
              <BrandWordmark size="sm" subtitle="" />
            </Link>

            <div className="hidden md:flex items-center gap-1.5 font-mono text-[10px] text-[#737373] tracking-widest uppercase border border-[#222222] px-2 py-0.5 rounded-[2px] bg-[#101010]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FAFAFA]" />
              SESSION: ENCRYPTED
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-xs)] font-mono text-xs tracking-wider transition-colors ${
                    isActive
                      ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]'
                      : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#101010]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: User Monogram & Sign Out */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-[#222222]">
              <div className="h-7 w-7 rounded-[var(--radius-xs)] bg-[#151515] border border-[#2D2D2D] flex items-center justify-center font-mono text-xs font-bold text-[#FAFAFA]">
                {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium text-[#FAFAFA] leading-none truncate max-w-[120px]">
                  {user?.displayName || 'Operator'}
                </span>
                <span className="text-[10px] font-mono text-[#737373] leading-none mt-0.5 truncate max-w-[120px]">
                  {user?.email || 'N/A'}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="hidden sm:inline-flex"
            >
              <LogOut className="h-3 w-3 mr-1.5" />
              Sign Out
            </Button>

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#737373] hover:text-[#FAFAFA] p-1.5 border border-[#2D2D2D] rounded-[2px]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[#2D2D2D] bg-[#101010] p-4 space-y-3 animate-slide-down">
            <div className="flex items-center gap-3 pb-3 border-b border-[#222222]">
              <div className="h-8 w-8 rounded-[var(--radius-xs)] bg-[#151515] border border-[#2D2D2D] flex items-center justify-center font-mono text-sm font-bold text-[#FAFAFA]">
                {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
              </div>
              <div>
                <p className="text-xs font-medium text-[#FAFAFA]">{user?.displayName}</p>
                <p className="text-[10px] font-mono text-[#737373]">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 p-2.5 rounded-[var(--radius-xs)] font-mono text-xs ${
                      isActive
                        ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]'
                        : 'text-[#737373] hover:bg-[#151515]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
            >
              <LogOut className="h-3 w-3 mr-1.5" />
              Sign Out
            </Button>
          </div>
        )}
      </header>

      {/* ─── Breadcrumb / Section Header Subbar (Optional) ─── */}
      {(headerTitle || pathname.startsWith('/settings')) && (
        <div className="bg-[#101010] border-b border-[#2D2D2D] py-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] text-[#737373] uppercase tracking-widest">
                <span>SYSTEM</span>
                <span>/</span>
                <span className="text-[#FAFAFA]">
                  {pathname.startsWith('/settings') ? 'SETTINGS CLUSTER' : 'WORKSPACE'}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-semibold text-[#FAFAFA] tracking-tight mt-0.5">
                {headerTitle || (pathname.includes('profile') ? 'Operator Identity' : pathname.includes('security') ? 'Security & Credentials' : 'Active Sessions')}
              </h1>
              {headerSubtitle && (
                <p className="text-xs text-[#737373] mt-0.5">{headerSubtitle}</p>
              )}
            </div>

            {/* Settings Quick Tabs */}
            {pathname.startsWith('/settings') && (
              <div className="flex items-center gap-1 font-mono text-xs">
                <Link
                  href="/settings/profile"
                  className={`px-3 py-1 rounded-[2px] transition-colors ${
                    pathname === '/settings/profile'
                      ? 'bg-[#FAFAFA] text-[#111111] font-semibold'
                      : 'text-[#737373] hover:text-[#FAFAFA]'
                  }`}
                >
                  PROFILE
                </Link>
                <Link
                  href="/settings/security"
                  className={`px-3 py-1 rounded-[2px] transition-colors ${
                    pathname === '/settings/security'
                      ? 'bg-[#FAFAFA] text-[#111111] font-semibold'
                      : 'text-[#737373] hover:text-[#FAFAFA]'
                  }`}
                >
                  SECURITY
                </Link>
                <Link
                  href="/settings/sessions"
                  className={`px-3 py-1 rounded-[2px] transition-colors ${
                    pathname === '/settings/sessions'
                      ? 'bg-[#FAFAFA] text-[#111111] font-semibold'
                      : 'text-[#737373] hover:text-[#FAFAFA]'
                  }`}
                >
                  SESSIONS
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Main Application Viewport ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {children}
      </main>

      {/* ─── Application Footer ─── */}
      <footer className="border-t border-[#1F1F1F] py-6 px-4 sm:px-6 lg:px-8 text-xs font-mono text-[#737373]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>KRONOS ARCHITECTURE 2026</span>
            <span>•</span>
            <span>SOVEREIGN ENVIRONMENT</span>
          </div>
          <div className="flex items-center gap-6">
            <span>LATENCY: 8ms</span>
            <span>STATUS: HARDENED</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export { AppShell };
