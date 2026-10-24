'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  usePathname,
  useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useWorkspace } from '@/context/workspace-context';
import { BrandLogo } from './ui';
import { FocusSessionItem } from '@/lib/api';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  GitBranch,
  GitPullRequest,
  FileText,
  Users,
  Cpu,
  BarChart3,
  Search,
  Zap,
  Terminal,
  Code2,
  Bell,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Plus,
  Shield,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight,
  MessageSquare,
  Layers,
  Target,
  Brain,
  ChevronDown,
  Check,
  ExternalLink,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSearch: () => void;
  onOpenQuickCapture: () => void;
  onOpenTerminal: () => void;
  onOpenDevToken: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
  activeFocusSession: FocusSessionItem | null;
}

interface NavItemDef {
  label: string;
  shortLabel: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onOpenSearch,
  onOpenQuickCapture,
  onOpenTerminal,
  onOpenDevToken,
  onOpenNotifications,
  unreadCount,
  activeFocusSession,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    onCloseMobile();
  }, [pathname]);

  const coreNavItems: NavItemDef[] = [
    { label: 'Command Center', shortLabel: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Tasks & Issues', shortLabel: 'Tasks', href: '/tasks', icon: CheckSquare },
    { label: 'Projects', shortLabel: 'Projects', href: '/projects', icon: FolderKanban },
    { label: 'Repositories', shortLabel: 'Repos', href: '/repositories', icon: GitBranch },
    { label: 'Code Reviews', shortLabel: 'Reviews', href: '/reviews', icon: GitPullRequest },
  ];

    const intelligenceNavItems: NavItemDef[] = [
    { label: 'Documents & Notes', shortLabel: 'Docs', href: '/documents', icon: FileText },
    { label: 'Team Channels', shortLabel: 'Chat', href: '/chat', icon: MessageSquare },
    { label: 'Architecture Canvas', shortLabel: 'Canvas', href: '/whiteboard', icon: Layers },
    { label: 'Goals & OKRs', shortLabel: 'Goals', href: '/goals', icon: Target },
    { label: 'Focus Workstation', shortLabel: 'Focus', href: '/focus', icon: Brain },
    { label: 'Collaboration', shortLabel: 'Team', href: '/collaboration', icon: Users },
    { label: 'Automations', shortLabel: 'Autos', href: '/automations', icon: Cpu },
    { label: 'Analytics', shortLabel: 'Metrics', href: '/analytics', icon: BarChart3 },
    { label: 'System Checklist', shortLabel: 'Checklist', href: '/checklist', icon: ShieldCheck, badge: 'VERIFIED' },
  ];

  const isRouteActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderNavLink = (item: NavItemDef) => {
    const active = isRouteActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={isCollapsed ? `${item.label}` : undefined}
        className={`group relative flex items-center gap-3 px-3 py-2 rounded-[var(--radius-xs)] font-mono text-xs transition-all duration-150 select-none ${
          active
            ? 'bg-[#181818] text-[#FAFAFA] font-medium border border-[#333333] shadow-sm'
            : 'text-[#888888] hover:text-[#FAFAFA] hover:bg-[#131313]'
        } ${isCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : ''}`}
      >
        {/* Active Pill Indicator */}
        {active && (
          <span
            className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#FAFAFA] shadow-[0_0_8px_rgba(255,255,255,0.4)] ${
              isCollapsed ? 'hidden' : 'block'
            }`}
          />
        )}

        <Icon
          className={`shrink-0 transition-transform duration-150 ${
            active ? 'text-[#FAFAFA] scale-105' : 'text-[#737373] group-hover:text-[#FAFAFA]'
          } ${isCollapsed ? 'h-4 w-4' : 'h-4 w-4'}`}
        />

        {!isCollapsed && (
          <span className="truncate flex-1 tracking-wide">{item.label}</span>
        )}

        {/* Collapsed Tooltip Flyout */}
        {isCollapsed && (
          <div className="absolute left-full ml-3 px-2.5 py-1 rounded-[2px] bg-[#161616] border border-[#2D2D2D] text-[#FAFAFA] text-[11px] font-mono tracking-wider whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-xl">
            {item.label}
          </div>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0B0B0B] border-r border-[#222222] text-[#FAFAFA] font-mono select-none">
      {/* ─── Top Brand & Workspace Header ─── */}
      <div
        className={`shrink-0 border-b border-[#1E1E1E] flex items-center justify-between ${
          isCollapsed ? 'p-3 flex-col gap-3' : 'px-4 py-3.5'
        }`}
      >
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 transition-opacity hover:opacity-85 ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="KRONOS Workspace"
        >
          <BrandLogo className={isCollapsed ? 'h-7 w-7' : 'h-7 w-7'} />
          {!isCollapsed && (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-[0.22em] text-[#FAFAFA]">
                  KRONOS
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="text-[9px] uppercase tracking-[0.16em] text-[#737373] -mt-0.5">
                AI WORK OS
              </span>
            </div>
          )}
        </Link>

        {/* Collapse Button (Desktop) */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center p-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#262626] text-[#737373] hover:text-[#FAFAFA] hover:border-[#404040] transition-colors"
          title={isCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden flex items-center justify-center p-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#262626] text-[#737373] hover:text-[#FAFAFA]"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ─── Active Workspace Selector Widget ─── */}
      <div className={`p-2.5 border-b border-[#1A1A1A] relative ${isCollapsed ? 'px-2' : ''}`}>
        <button
          type="button"
          onClick={() => setIsWorkspaceDropdownOpen((prev) => !prev)}
          className={`w-full flex items-center justify-between rounded-[var(--radius-xs)] bg-[#121212] border border-[#242424] hover:border-[#3E3E3E] hover:bg-[#151515] transition-all text-xs ${
            isCollapsed ? 'p-2 justify-center' : 'px-2.5 py-2'
          }`}
          title={currentWorkspace ? `${currentWorkspace.name} (${currentWorkspace.role})` : 'Select Workspace'}
        >
          {isCollapsed ? (
            <div className="h-6 w-6 rounded-[2px] bg-[#1E1E1E] border border-[#333333] flex items-center justify-center text-[10px] font-bold text-[#FAFAFA]">
              {currentWorkspace?.name ? currentWorkspace.name.slice(0, 2).toUpperCase() : 'WS'}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="h-5 w-5 rounded-[2px] bg-[#1A1A1A] border border-[#2D2D2D] flex items-center justify-center text-[9px] font-bold text-[#FAFAFA] shrink-0">
                  {currentWorkspace?.name ? currentWorkspace.name.slice(0, 2).toUpperCase() : 'WS'}
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-[11px] font-medium text-[#FAFAFA] truncate">
                    {currentWorkspace?.name || 'Workspace'}
                  </span>
                  <span className="text-[9px] text-[#737373] uppercase tracking-wider">
                    {currentWorkspace?.role || 'MEMBER'}
                  </span>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[#737373] shrink-0 ml-1.5" />
            </>
          )}
        </button>

        {/* Dropdown Menu */}
        {isWorkspaceDropdownOpen && (
          <div className="absolute left-2 right-2 top-full mt-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#2E2E2E] shadow-2xl z-50 p-1.5 space-y-1 animate-fade-in font-mono">
            <div className="px-2 py-1 flex items-center justify-between text-[10px] text-[#737373] uppercase tracking-wider border-b border-[#1E1E1E] pb-1.5">
              <span>WORKSPACES ({workspaces.length})</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1">
              {workspaces.map((ws) => {
                const isActive = ws.id === currentWorkspace?.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      switchWorkspace(ws.id);
                      setIsWorkspaceDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[2px] text-xs transition-colors text-left ${
                      isActive
                        ? 'bg-[#1C1C1C] text-[#FAFAFA] font-medium border border-[#333333]'
                        : 'text-[#888888] hover:text-[#FAFAFA] hover:bg-[#161616]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px]">{ws.name}</p>
                      <span className="text-[9px] text-[#666666]">{ws.role}</span>
                    </div>
                    {isActive && <Check className="h-3 w-3 text-emerald-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
            <div className="pt-1 border-t border-[#1E1E1E]">
              <Link
                href="/collaboration"
                onClick={() => setIsWorkspaceDropdownOpen(false)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[2px] text-[10px] text-neutral-400 hover:text-white hover:bg-[#161616] transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>Manage & Invite</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ─── Fast Action Triggers Strip ─── */}
      <div className={`p-3 shrink-0 space-y-1.5 border-b border-[#1A1A1A] ${isCollapsed ? 'px-2' : ''}`}>
        {/* Global Search Button */}
        <button
          type="button"
          onClick={onOpenSearch}
          title={isCollapsed ? 'Search or run command (⌘K)' : undefined}
          className={`group w-full flex items-center gap-2.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#242424] hover:border-[#3D3D3D] text-[#737373] hover:text-[#FAFAFA] text-xs transition-colors ${
            isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2'
          }`}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-[#888888] group-hover:text-[#FAFAFA]" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left text-[11px] text-[#888888] group-hover:text-[#CCCCCC]">
                Search command...
              </span>
              <kbd className="px-1.5 py-0.5 text-[9px] bg-[#1A1A1A] border border-[#2C2C2C] rounded-[2px] text-[#888888]">
                ⌘K
              </kbd>
            </>
          )}
        </button>

        {/* Quick Capture Button */}
        <button
          type="button"
          onClick={onOpenQuickCapture}
          title={isCollapsed ? 'Universal Quick Capture (⌘J)' : undefined}
          className={`group w-full flex items-center gap-2.5 rounded-[var(--radius-xs)] bg-[#141414] border border-[#262626] hover:border-amber-500/50 text-[#FAFAFA] text-xs transition-colors ${
            isCollapsed ? 'justify-center p-2.5' : 'px-3 py-1.5'
          }`}
        >
          <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400 group-hover:scale-110 transition-transform" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left text-[11px] font-medium text-neutral-200">
                Quick Capture
              </span>
              <kbd className="px-1.5 py-0.5 text-[9px] bg-[#1A1A1A] border border-[#2C2C2C] rounded-[2px] text-[#888888]">
                ⌘J
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* ─── Scrollable Nav Items ─── */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5 scrollbar-thin">
        {/* WORKSPACE CLUSTER */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-[#555555] font-semibold">
              Core Workspace
            </div>
          )}
          <nav className="space-y-0.5">
            {coreNavItems.map(renderNavLink)}
          </nav>
        </div>

        {/* INTELLIGENCE & OPS */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-[#555555] font-semibold">
              Knowledge & Ops
            </div>
          )}
          <nav className="space-y-0.5">
            {intelligenceNavItems.map(renderNavLink)}
          </nav>
        </div>

        {/* DEVELOPER TOOLS */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-[#555555] font-semibold">
              Developer CLI
            </div>
          )}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={onOpenTerminal}
              title={isCollapsed ? 'In-App Terminal CLI (⌘`)' : undefined}
              className={`group w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-xs)] text-xs text-[#888888] hover:text-[#FAFAFA] hover:bg-[#131313] transition-colors ${
                isCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : ''
              }`}
            >
              <Terminal className="h-4 w-4 shrink-0 text-[#737373] group-hover:text-emerald-400" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left tracking-wide">Terminal CLI</span>
                  <kbd className="px-1.5 py-0.5 text-[9px] bg-[#181818] border border-[#2A2A2A] rounded-[2px] text-[#737373]">
                    ⌘`
                  </kbd>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenDevToken}
              title={isCollapsed ? 'Developer Token & CLI Setup' : undefined}
              className={`group w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-xs)] text-xs text-[#888888] hover:text-[#FAFAFA] hover:bg-[#131313] transition-colors ${
                isCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : ''
              }`}
            >
              <Code2 className="h-4 w-4 shrink-0 text-[#737373] group-hover:text-cyan-400" />
              {!isCollapsed && (
                <span className="flex-1 text-left tracking-wide">CLI Token</span>
              )}
            </button>
          </div>
        </div>

        {/* ACTIVE FOCUS SESSION WIDGET */}
        {activeFocusSession && activeFocusSession.status === 'RUNNING' && (
          <div className="pt-2">
            {!isCollapsed ? (
              <Link
                href="/dashboard"
                className="block p-3 rounded-[var(--radius-xs)] bg-[#121614] border border-emerald-900/60 hover:border-emerald-600 transition-colors"
                title="Active focus session in progress"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Deep Focus
                  </span>
                  <Clock className="h-3 w-3 text-emerald-400/80" />
                </div>
                <p className="text-xs font-semibold text-[#FAFAFA] truncate">
                  {activeFocusSession.title}
                </p>
                <p className="text-[10px] text-[#737373] mt-1 flex items-center gap-1">
                  Tap to open dashboard <ChevronRight className="h-2.5 w-2.5" />
                </p>
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="relative flex items-center justify-center h-10 w-10 mx-auto rounded-[var(--radius-xs)] bg-[#121614] border border-emerald-800/80 text-emerald-400"
                title={`Active Focus: ${activeFocusSession.title}`}
              >
                <span className="animate-ping absolute -top-1 -right-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
                <Clock className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ─── Bottom Operator / Settings Cluster ─── */}
      <div className="shrink-0 border-t border-[#1E1E1E] bg-[#0E0E0E] p-2.5 space-y-2">
        {/* Notifications & Settings Quick Bar */}
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'justify-between px-1'}`}>
          {/* Notifications Button */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-[var(--radius-xs)] bg-[#141414] border border-[#242424] hover:border-[#3E3E3E] text-[#888888] hover:text-[#FAFAFA] transition-colors"
            title="Open Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-3.5 w-3.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#FAFAFA] text-[#080808] text-[9px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {!isCollapsed ? (
            <div className="flex items-center gap-1">
              <Link
                href="/settings/profile"
                className="p-2 rounded-[var(--radius-xs)] text-[#888888] hover:text-[#FAFAFA] hover:bg-[#161616] transition-colors"
                title="Workspace Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-[var(--radius-xs)] text-[#888888] hover:text-red-400 hover:bg-[#161616] transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/settings/profile"
              className="p-2 rounded-[var(--radius-xs)] bg-[#141414] border border-[#242424] text-[#888888] hover:text-[#FAFAFA] transition-colors"
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* User Identity Profile Card */}
        <div
          className={`flex items-center rounded-[var(--radius-xs)] bg-[#121212] border border-[#202020] ${
            isCollapsed ? 'p-1.5 justify-center' : 'p-2 gap-2.5'
          }`}
        >
          <div className="h-7 w-7 rounded-[2px] bg-[#1A1A1A] border border-[#2E2E2E] flex items-center justify-center text-xs font-bold text-[#FAFAFA] shrink-0">
            {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#FAFAFA] truncate leading-tight">
                {user?.displayName || 'Operator'}
              </p>
              <p className="text-[10px] text-[#666666] truncate mt-0.5">
                {user?.email || 'operator@kronos.internal'}
              </p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="px-1 pt-1 flex items-center justify-between text-[9px] text-[#4E4E4E] tracking-widest uppercase">
            <span>SOVEREIGN ARCH</span>
            <span>TLS 1.3 SECURE</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Desktop Sticky Sidebar ─── */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-200 z-30 ${
          isCollapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* ─── Mobile Slide-in Drawer ─── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 w-72 bg-[#0B0B0B] shadow-2xl z-10 animate-slide-right flex flex-col">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
