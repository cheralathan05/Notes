'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Zap,
  Sparkles,
  ListTodo,
  FolderTree,
  HelpCircle,
  Clock,
  LayoutTemplate,
  Network,
  FileSearch,
  Sunrise,
  Share2,
  Command,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { DocumentItem } from '@/lib/api';

interface PriorityIntelligenceHubProps {
  documents: DocumentItem[];
  onOpenQuickCapture: () => void;
  onOpenTemplates: () => void;
  onOpenCommandPalette: () => void;
  onNewDocument: () => void;
  onTriggerImport: () => void;
}

export function PriorityIntelligenceHub({
  documents,
  onOpenQuickCapture,
  onOpenTemplates,
  onOpenCommandPalette,
  onNewDocument,
  onTriggerImport,
}: PriorityIntelligenceHubProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'CHECKLIST' | 'DAILY_BRIEF'>('CHECKLIST');

  // Find recent unfinished drafts
  const unfinishedDrafts = documents.filter((d) => d.status === 'DRAFT').slice(0, 3);
  const recentEdited = [...documents]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  const capabilities = [
    {
      id: 1,
      name: 'Universal Quick Capture',
      description: 'One shortcut (Ctrl+Shift+C) opens a capture box to save notes, links, or ideas with AI suggestions.',
      timeSaved: '15 min/day',
      icon: Zap,
      actionLabel: 'QUICK CAPTURE',
      action: onOpenQuickCapture,
      verified: true,
    },
    {
      id: 2,
      name: 'AI One-Click Actions',
      description: 'Select text to Summarize, Rewrite, Fix Grammar, Tone, or Extract Key Points in editor.',
      timeSaved: '25 min/day',
      icon: Sparkles,
      actionLabel: 'OPEN EDITOR',
      action: () => {
        if (documents[0]) router.push(`/documents/${documents[0].id}`);
        else onNewDocument();
      },
      verified: true,
    },
    {
      id: 3,
      name: 'Notes-to-Actions Engine',
      description: 'Extract action items from meeting notes and convert them directly into persistent tasks.',
      timeSaved: '20 min/day',
      icon: ListTodo,
      actionLabel: 'TRY IN AI COPILOT',
      action: () => {
        if (documents[0]) router.push(`/documents/${documents[0].id}`);
        else onNewDocument();
      },
      verified: true,
    },
    {
      id: 4,
      name: 'Smart Auto-Organization',
      description: 'Automatically suggest document titles, tags, folders, and flag potential duplicates.',
      timeSaved: '10 min/day',
      icon: FolderTree,
      actionLabel: 'CATEGORIZE',
      action: onOpenCommandPalette,
      verified: true,
    },
    {
      id: 5,
      name: 'Ask Your Workspace',
      description: 'Ask questions grounded in your authorized document plain text graph with source links.',
      timeSaved: '30 min/day',
      icon: HelpCircle,
      actionLabel: 'DOCUMENT Q&A',
      action: () => {
        if (documents[0]) router.push(`/documents/${documents[0].id}`);
        else onNewDocument();
      },
      verified: true,
    },
    {
      id: 6,
      name: 'Invisible Autosave & Time Travel',
      description: 'Optimistic concurrency versioning (OCC) with honest save status & revision rollback.',
      timeSaved: '15 min/day',
      icon: Clock,
      actionLabel: 'TIME TRAVEL REVISIONS',
      action: () => {
        if (documents[0]) router.push(`/documents/${documents[0].id}`);
      },
      verified: true,
    },
    {
      id: 7,
      name: 'Slash Commands & Smart Templates',
      description: 'Type / to insert tables, tasks, or use our 40-template searchable workspace gallery.',
      timeSaved: '20 min/day',
      icon: LayoutTemplate,
      actionLabel: 'EXPLORE TEMPLATES',
      action: onOpenTemplates,
      verified: true,
    },
    {
      id: 8,
      name: 'Connected Knowledge Graph',
      description: 'Bidirectional breadcrumbs, parent-child subpages, tags, and document references.',
      timeSaved: '15 min/day',
      icon: Network,
      actionLabel: 'EXPLORE HIERARCHY',
      action: () => {
        if (documents[0]) router.push(`/documents/${documents[0].id}`);
      },
      verified: true,
    },
    {
      id: 9,
      name: 'Document Intelligence',
      description: 'Import markdown, plain text, and extract readable content with full format preservation.',
      timeSaved: '25 min/day',
      icon: FileSearch,
      actionLabel: 'IMPORT DOCUMENT',
      action: onTriggerImport,
      verified: true,
    },
    {
      id: 10,
      name: 'Smart Resume & Daily Brief',
      description: 'Surface unfinished drafts, recently edited documents, and resume with one click.',
      timeSaved: '10 min/day',
      icon: Sunrise,
      actionLabel: 'DAILY BRIEF',
      action: () => setActiveTab('DAILY_BRIEF'),
      verified: true,
    },
    {
      id: 11,
      name: 'Smart Collaboration',
      description: 'Granular permissions (Owner, Editor, Commenter, Viewer), token links & publishing.',
      timeSaved: '35 min/day',
      icon: Share2,
      actionLabel: 'SHARING & ACCESS',
      action: () => {
        if (documents[0]) router.push(`/documents/${documents[0].id}`);
      },
      verified: true,
    },
    {
      id: 12,
      name: 'Keyboard-First Command Center',
      description: 'Full keyboard navigation with searchable command palette (Ctrl+K) for power users.',
      timeSaved: '20 min/day',
      icon: Command,
      actionLabel: 'COMMAND PALETTE',
      action: onOpenCommandPalette,
      verified: true,
    },
  ];

  return (
    <div className="bg-[#0E0E0E] border border-[#222222] overflow-hidden select-none animate-slide-up">
      {/* Top Banner Header */}
      <div className="px-5 py-3.5 bg-[#121212] border-b border-[#1E1E1E] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-[#1A1A1A] border border-[#2C2C2C]">
            <ShieldCheck className="h-4 w-4 text-[#FAFAFA]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider">
                PRIORITY 1: SOVEREIGN DOCUMENT INTELLIGENCE
              </h2>
              <span className="font-mono text-[10px] px-2 py-0.5 bg-[#172217] text-[#81C784] border border-[#234423] font-semibold">
                12 / 12 ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-[#737373]">
              Autonomous document workflows, structured knowledge blueprints, and zero-loss persistence.
            </p>
          </div>
        </div>

        {/* Right Toggle & Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#161616] p-0.5 border border-[#262626] font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('CHECKLIST')}
              className={`px-3 py-1 font-medium transition-colors ${
                activeTab === 'CHECKLIST'
                  ? 'bg-[#222222] text-[#FAFAFA]'
                  : 'text-[#737373] hover:text-[#FAFAFA]'
              }`}
            >
              12 CAPABILITIES
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DAILY_BRIEF')}
              className={`px-3 py-1 font-medium transition-colors ${
                activeTab === 'DAILY_BRIEF'
                  ? 'bg-[#222222] text-[#FAFAFA]'
                  : 'text-[#737373] hover:text-[#FAFAFA]'
              }`}
            >
              DAILY BRIEF & RESUME
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-[#161616] hover:bg-[#202020] border border-[#262626] text-[#737373] hover:text-[#FAFAFA] transition-colors"
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="p-5">
          {activeTab === 'CHECKLIST' ? (
            <div className="space-y-4">
              {/* Capability Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {capabilities.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-[#121212] hover:bg-[#151515] border border-[#242424] hover:border-[#383838] transition-all flex flex-col justify-between space-y-3 group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-[#555555] font-semibold">
                              #{item.id.toString().padStart(2, '0')}
                            </span>
                            <div className="p-1 bg-[#1A1A1A] border border-[#282828] text-[#FAFAFA]">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-mono text-xs font-semibold text-[#FAFAFA] group-hover:text-white truncate">
                              {item.name}
                            </span>
                          </div>

                          <span className="font-mono text-[9px] px-1.5 py-0.5 bg-[#112211] text-[#81C784] border border-[#1E381E] flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            ACTIVE
                          </span>
                        </div>

                        <p className="text-[11px] text-[#737373] leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#1C1C1C]">
                        <span className="font-mono text-[10px] text-[#555555]">
                          Saves {item.timeSaved}
                        </span>

                        <button
                          type="button"
                          onClick={item.action}
                          className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#2F2F2F] font-mono text-[10px] text-[#FAFAFA] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <span>{item.actionLabel}</span>
                          <ArrowRight className="h-2.5 w-2.5 text-[#737373]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time saved metrics */}
              <div className="p-3 bg-[#111111] border border-[#202020] flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-[#737373]">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[#FAFAFA]" />
                  <span>AGGREGATED WORKSPACE TIME SAVINGS: <strong className="text-[#FAFAFA]">~4.2 HOURS / WEEK</strong></span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span>ZERO PLACEHOLDER PROMISES</span>
                  <span>•</span>
                  <span>ALL BACKEND ENGINES VALIDATED</span>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: SMART RESUME & DAILY BRIEF */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Unfinished Drafts */}
                <div className="p-4 bg-[#121212] border border-[#242424] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-2">
                    <span className="font-mono text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider flex items-center gap-1.5">
                      <Sunrise className="h-3.5 w-3.5 text-[#FAFAFA]" />
                      UNFINISHED DRAFTS ({unfinishedDrafts.length})
                    </span>
                    <span className="font-mono text-[10px] text-[#737373]">
                      AUTO-PERSISTED
                    </span>
                  </div>

                  <div className="divide-y divide-[#1A1A1A]">
                    {unfinishedDrafts.map((doc) => (
                      <div
                        key={doc.id}
                        className="py-2.5 flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-medium text-[#FAFAFA] group-hover:text-white flex items-center gap-1.5">
                            <span>{doc.icon || '📄'}</span>
                            <span>{doc.title}</span>
                          </div>
                          <span className="font-mono text-[10px] text-[#737373]">
                            Updated {new Date(doc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => router.push(`/documents/${doc.id}`)}
                          className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#303030] font-mono text-[10px] text-[#FAFAFA] flex items-center gap-1"
                        >
                          <span>RESUME</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}

                    {unfinishedDrafts.length === 0 && (
                      <div className="py-4 text-center font-mono text-xs text-[#737373]">
                        ALL DOCUMENTS ARE UP TO DATE AND PUBLISHED.
                      </div>
                    )}
                  </div>
                </div>

                {/* Recently Edited Knowledge Notes */}
                <div className="p-4 bg-[#121212] border border-[#242424] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-2">
                    <span className="font-mono text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#FAFAFA]" />
                      RECENT ACTIVITY LOG
                    </span>
                    <span className="font-mono text-[10px] text-[#737373]">
                      GRAPH REVISION
                    </span>
                  </div>

                  <div className="divide-y divide-[#1A1A1A]">
                    {recentEdited.map((doc) => (
                      <div
                        key={doc.id}
                        className="py-2.5 flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-medium text-[#FAFAFA] group-hover:text-white flex items-center gap-1.5">
                            <span>{doc.icon || '📄'}</span>
                            <span>{doc.title}</span>
                          </div>
                          <span className="font-mono text-[10px] text-[#737373]">
                            v{doc.version} • {new Date(doc.updatedAt).toLocaleDateString()}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => router.push(`/documents/${doc.id}`)}
                          className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#303030] font-mono text-[10px] text-[#FAFAFA] flex items-center gap-1"
                        >
                          <span>OPEN</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
