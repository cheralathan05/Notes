'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { Card, Badge } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { api, SessionInfo } from '@/lib/api';
import {
  ShieldCheck,
  User,
  Laptop,
  Terminal,
  ChevronRight,
  Shield,
  Clock,
  Hash,
  CheckCircle2,
} from 'lucide-react';

export default function SettingsHubPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadSessions() {
      try {
        const res = await api.getSessions();
        if (isMounted && res.success && res.data?.sessions) {
          setSessions(res.data.sessions);
        }
      } catch {
        // Safe fallback
      } finally {
        if (isMounted) setLoadingSessions(false);
      }
    }
    loadSessions();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppShell
      headerTitle="Settings & Configuration"
      headerSubtitle="Manage sovereign operator credentials, security postures, active sessions, and developer tooling"
    >
      <div className="max-w-5xl space-y-8 font-mono">
        {/* Navigation Tabs Strip */}
        <div className="flex items-center gap-2 border-b border-[#222222] pb-3 text-xs overflow-x-auto">
          <Link
            href="/settings"
            className="px-3 py-1.5 rounded-[var(--radius-xs)] bg-[#181818] text-[#FAFAFA] border border-[#333333] font-medium"
          >
            Overview
          </Link>
          <Link
            href="/settings/profile"
            className="px-3 py-1.5 rounded-[var(--radius-xs)] text-[#888888] hover:text-[#FAFAFA] hover:bg-[#121212] transition-colors"
          >
            Profile
          </Link>
          <Link
            href="/settings/security"
            className="px-3 py-1.5 rounded-[var(--radius-xs)] text-[#888888] hover:text-[#FAFAFA] hover:bg-[#121212] transition-colors"
          >
            Security & Auth
          </Link>
          <Link
            href="/settings/sessions"
            className="px-3 py-1.5 rounded-[var(--radius-xs)] text-[#888888] hover:text-[#FAFAFA] hover:bg-[#121212] transition-colors"
          >
            Active Sessions
          </Link>
        </div>

        {/* Identity & Status Overview Banner */}
        <Card className="p-6 sm:p-8 bg-[#0D0D0D] border-[#222222]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#1E1E1E]">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-[var(--radius-sm)] bg-[#141414] border border-[#2D2D2D] flex items-center justify-center text-xl font-bold text-[#FAFAFA] shadow-inner">
                {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'O'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[#FAFAFA] tracking-tight">
                    {user?.displayName || 'Active Operator'}
                  </h2>
                  <Badge variant={user?.emailVerified ? 'active' : 'default'}>
                    {user?.emailVerified ? 'VERIFIED' : 'ACTIVE'}
                  </Badge>
                </div>
                <p className="text-xs text-[#737373] mt-1">{user?.email || 'operator@kronos.internal'}</p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1 text-[11px] text-[#737373]">
              <div className="flex items-center gap-1.5">
                <Hash className="h-3 w-3" />
                <span>UID: {user?.id ? `${user.id.slice(0, 12)}...` : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>MEMBER SINCE: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '2026'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            <div className="p-4 rounded-[var(--radius-xs)] bg-[#121212] border border-[#202020]">
              <div className="flex items-center justify-between text-[#888888] mb-1 text-xs">
                <span>SECURITY LEVEL</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-[#FAFAFA]">TLS 1.3 / BCRYPT</p>
              <p className="text-[10px] text-[#666666] mt-0.5">Argon2/Bcrypt hash verification</p>
            </div>

            <div className="p-4 rounded-[var(--radius-xs)] bg-[#121212] border border-[#202020]">
              <div className="flex items-center justify-between text-[#888888] mb-1 text-xs">
                <span>ACTIVE SESSIONS</span>
                <Laptop className="h-4 w-4 text-cyan-400" />
              </div>
              <p className="text-sm font-semibold text-[#FAFAFA]">
                {loadingSessions ? '...' : `${sessions.length} Device${sessions.length === 1 ? '' : 's'}`}
              </p>
              <p className="text-[10px] text-[#666666] mt-0.5">Persisted bearer session tokens</p>
            </div>

            <div className="p-4 rounded-[var(--radius-xs)] bg-[#121212] border border-[#202020]">
              <div className="flex items-center justify-between text-[#888888] mb-1 text-xs">
                <span>AUTHENTICATION</span>
                <CheckCircle2 className="h-4 w-4 text-neutral-300" />
              </div>
              <p className="text-sm font-semibold text-[#FAFAFA]">STATEFUL SESSION</p>
              <p className="text-[10px] text-[#666666] mt-0.5">Database backed & revocable</p>
            </div>
          </div>
        </Card>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Profile Card */}
          <Link
            href="/settings/profile"
            className="group block p-6 rounded-[var(--radius-sm)] bg-[#101010] border border-[#222222] hover:border-[#3A3A3A] hover:bg-[#141414] transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-[var(--radius-xs)] bg-[#181818] border border-[#282828] text-[#FAFAFA]">
                <User className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-[#555555] group-hover:text-[#FAFAFA] group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="text-sm font-semibold text-[#FAFAFA] mt-4 tracking-tight">Operator Profile</h3>
            <p className="text-xs text-[#737373] mt-1.5 leading-relaxed">
              Update your public display name, inspect your verified email claims, and review sovereign account metadata.
            </p>
            <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[11px] text-[#888888]">
              <span>Name: {user?.displayName || 'Operator'}</span>
              <span className="text-[#FAFAFA] font-medium group-hover:underline">Manage &rarr;</span>
            </div>
          </Link>

          {/* Security Card */}
          <Link
            href="/settings/security"
            className="group block p-6 rounded-[var(--radius-sm)] bg-[#101010] border border-[#222222] hover:border-[#3A3A3A] hover:bg-[#141414] transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-[var(--radius-xs)] bg-[#181818] border border-[#282828] text-[#FAFAFA]">
                <Shield className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-[#555555] group-hover:text-[#FAFAFA] group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="text-sm font-semibold text-[#FAFAFA] mt-4 tracking-tight">Security & Credentials</h3>
            <p className="text-xs text-[#737373] mt-1.5 leading-relaxed">
              Rotate sovereign account password, enforce complexity requirements, and configure verification policies.
            </p>
            <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[11px] text-[#888888]">
              <span>Status: Enforced</span>
              <span className="text-[#FAFAFA] font-medium group-hover:underline">Update Password &rarr;</span>
            </div>
          </Link>

          {/* Sessions Card */}
          <Link
            href="/settings/sessions"
            className="group block p-6 rounded-[var(--radius-sm)] bg-[#101010] border border-[#222222] hover:border-[#3A3A3A] hover:bg-[#141414] transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-[var(--radius-xs)] bg-[#181818] border border-[#282828] text-[#FAFAFA]">
                <Laptop className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-[#555555] group-hover:text-[#FAFAFA] group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="text-sm font-semibold text-[#FAFAFA] mt-4 tracking-tight">Active Sessions</h3>
            <p className="text-xs text-[#737373] mt-1.5 leading-relaxed">
              Audit active browser sessions, IP geolocation metadata, device footprints, and perform remote revocations.
            </p>
            <div className="mt-4 pt-3 border-t border-[#1C1C1C] flex items-center justify-between text-[11px] text-[#888888]">
              <span>{sessions.length} Active Session{sessions.length === 1 ? '' : 's'}</span>
              <span className="text-[#FAFAFA] font-medium group-hover:underline">Inspect &rarr;</span>
            </div>
          </Link>

          {/* Developer CLI & Tokens */}
          <div className="p-6 rounded-[var(--radius-sm)] bg-[#101010] border border-[#222222] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-[var(--radius-xs)] bg-[#181818] border border-[#282828] text-cyan-400">
                  <Terminal className="h-5 w-5" />
                </div>
                <Badge variant="active">CLI READY</Badge>
              </div>
              <h3 className="text-sm font-semibold text-[#FAFAFA] mt-4 tracking-tight">Atlas Developer CLI</h3>
              <p className="text-xs text-[#737373] mt-1.5 leading-relaxed">
                Execute tasks, sync distributed workspace state, and trigger background automations via the native terminal CLI.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#1C1C1C]">
              <code className="block p-2 rounded-[var(--radius-xs)] bg-[#0A0A0A] border border-[#222222] text-[11px] text-[#CCCCCC] truncate">
                npm run atlas -- tasks
              </code>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
