'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { Card, Button, Badge } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api';
import {
  ShieldCheck,
  User,
  KeyRound,
  Layers,
  FolderKanban,
  FileText,
  Plus,
  ArrowRight,
  Clock,
  Terminal,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  useEffect(() => {
    api.getSessions().then((res) => {
      if (res.success && res.data?.sessions) {
        setSessionCount(res.data.sessions.length);
      }
    });
  }, []);

  return (
    <AppShell
      headerTitle="Sovereign Workspace"
      headerSubtitle="Real-time cryptographic control center and operator intelligence"
    >
      <div className="space-y-8 animate-fade-in">
        {/* Architectural Hero Banner */}
        <div className="p-6 sm:p-8 rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-grid-pattern opacity-20 pointer-events-none" />

          <div className="max-w-2xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#151515] border border-[#2D2D2D] font-mono text-[10px] uppercase text-[#FAFAFA]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FAFAFA]" />
              SESSION AUTHENTICATED // TLS 1.3
            </div>

            <h2 className="text-2xl sm:text-3xl font-light text-[#FAFAFA] tracking-tight leading-snug">
              Welcome back, <span className="font-semibold">{user?.displayName || 'Operator'}</span>
            </h2>

            <p className="text-sm text-[#737373] leading-relaxed">
              Your sovereign environment is synchronized. All local data graphs are protected with Argon2id hashing and HttpOnly session encapsulation.
            </p>
          </div>
        </div>

        {/* Telemetry Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#737373]">
              <span>OPERATOR STATUS</span>
              <User className="h-4 w-4 text-[#FAFAFA]" />
            </div>
            <div>
              <div className="text-xl font-bold text-[#FAFAFA] truncate">
                {user?.displayName || 'OPERATOR'}
              </div>
              <p className="text-[11px] text-[#737373] mt-0.5 truncate">{user?.email}</p>
            </div>
            <div className="pt-1 border-t border-[#222222]">
              <span className="text-[10px] text-[#FAFAFA]">
                {user?.emailVerified ? '• IDENTITY VERIFIED' : '• ACCESS GRANTED'}
              </span>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#737373]">
              <span>ACTIVE SESSIONS</span>
              <Layers className="h-4 w-4 text-[#FAFAFA]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#FAFAFA]">
                {sessionCount !== null ? sessionCount : '1'}
              </div>
              <p className="text-[11px] text-[#737373] mt-0.5">AUTHORIZATION TOKENS</p>
            </div>
            <div className="pt-1 border-t border-[#222222]">
              <Link href="/settings/sessions" className="text-[10px] text-[#FAFAFA] hover:underline flex items-center justify-between">
                <span>INSPECT TOKENS</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#737373]">
              <span>CRYPTOGRAPHY</span>
              <KeyRound className="h-4 w-4 text-[#FAFAFA]" />
            </div>
            <div>
              <div className="text-base font-bold text-[#FAFAFA]">ARGON2ID</div>
              <p className="text-[11px] text-[#737373] mt-0.5">MEMORY COST 64MB</p>
            </div>
            <div className="pt-1 border-t border-[#222222]">
              <Link href="/settings/security" className="text-[10px] text-[#FAFAFA] hover:underline flex items-center justify-between">
                <span>MANAGE KEYS</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#737373]">
              <span>CLUSTER TELEMETRY</span>
              <Terminal className="h-4 w-4 text-[#FAFAFA]" />
            </div>
            <div>
              <div className="text-base font-bold text-[#FAFAFA]">ONLINE</div>
              <p className="text-[11px] text-[#737373] mt-0.5">POSTGRESQL PORT 5432</p>
            </div>
            <div className="pt-1 border-t border-[#222222]">
              <span className="text-[10px] text-[#FAFAFA]">• LATENCY: &lt;10MS</span>
            </div>
          </Card>
        </div>

        {/* Workspaces & Notes Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-[#FAFAFA]" />
                <h3 className="text-sm font-semibold text-[#FAFAFA] tracking-wide uppercase font-mono">
                  Sovereign Workspaces
                </h3>
              </div>
              <Button size="sm" variant="outline">
                <Plus className="h-3 w-3 mr-1" /> New Workspace
              </Button>
            </div>

            <p className="text-xs text-[#737373] leading-relaxed">
              Isolated workspace domains for structured intelligence, technical docs, and secure team collaboration.
            </p>

            <div className="p-4 rounded-[var(--radius-sm)] bg-[#101010] border border-[#222222] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#FAFAFA]">Primary Architecture Workspace</p>
                <p className="text-xs font-mono text-[#737373] mt-0.5">Owner: {user?.displayName}</p>
              </div>
              <Badge variant="active">HARDENED</Badge>
            </div>
          </Card>

          <Card className="p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#FAFAFA]" />
                <h3 className="text-sm font-semibold text-[#FAFAFA] tracking-wide uppercase font-mono">
                  Documents & Notes
                </h3>
              </div>
              <Link href="/documents">
                <Button size="sm" variant="outline">
                  <ArrowRight className="h-3 w-3 mr-1" /> Open Documents
                </Button>
              </Link>
            </div>

            <p className="text-xs text-[#737373] leading-relaxed">
              Full markdown documents, executive briefs, technical blueprints, and AI-assisted notes.
            </p>

            <Link href="/documents" className="p-4 rounded-[var(--radius-sm)] bg-[#101010] border border-[#222222] hover:border-[#505050] flex items-center justify-between transition-colors block">
              <div>
                <p className="text-sm font-medium text-[#FAFAFA]">Sovereign Documents Library</p>
                <p className="text-xs font-mono text-[#737373] mt-0.5">Explore notes, folders, and templates</p>
              </div>
              <Badge variant="active">ENTERPRISE</Badge>
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
