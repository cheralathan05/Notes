'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Button } from './ui';
import { Sidebar } from './sidebar';
import { CommandPalette } from '@/components/documents/command-palette';
import { UniversalQuickCapture } from '@/components/documents/universal-quick-capture';
import { TerminalCommandCenter } from '@/components/tasks/terminal-command-center';
import { DeveloperTokenModal } from '@/components/developer/developer-token-modal';
import { api, API_BASE_URL, NotificationItem, FocusSessionItem } from '@/lib/api';
import {
  Menu,
  PanelLeftOpen,
  PanelLeftClose,
  Search,
  Zap,
  Terminal,
  Code2,
  Bell,
  Check,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
}

export default function AppShell({ children, headerTitle, headerSubtitle }: AppShellProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Sidebar collapse & mobile states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Global modals
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [devTokenModalOpen, setDevTokenModalOpen] = useState(false);

  // Notifications state
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // Focus Telemetry state
  const [activeFocusSession, setActiveFocusSession] = useState<FocusSessionItem | null>(null);

  // Hydrate sidebar collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kronos:sidebar-collapsed');
      if (saved === 'true') {
        setIsSidebarCollapsed(true);
      }
    } catch (e) {
      // Ignored
    }
  }, []);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('kronos:sidebar-collapsed', String(next));
      } catch (e) {
        // Ignored
      }
      return next;
    });
  };

  // Global Keyboard Shortcuts (Cmd+K for Search, Cmd+J for Quick Capture, Cmd+` for Terminal, Cmd+B for Sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setQuickCaptureOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '`' || e.key === '\\')) {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch initial notifications and focus session
  useEffect(() => {
    const loadTelemetry = async () => {
      try {
        const [notifRes, focusRes] = await Promise.all([
          api.getNotifications({ unreadOnly: true, limit: 5 }),
          api.getActiveFocusSession(),
        ]);

        if (notifRes.success && notifRes.data) {
          setNotifications(notifRes.data.notifications || []);
          setUnreadCount(notifRes.data.unreadCount || 0);
        }

        if (focusRes.success && focusRes.data?.session) {
          setActiveFocusSession(focusRes.data.session);
        }
      } catch (err) {
        console.error('Failed to load telemetry in AppShell:', err);
      }
    };

    loadTelemetry();

    // Listen to real-time events via SSE
    const apiBase = API_BASE_URL;
    const eventSource = new EventSource(`${apiBase}/api/tasks/events`, {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'NOTIFICATION_CREATED') {
          setUnreadCount((prev) => prev + 1);
          if (payload.data?.notification) {
            setNotifications((prev) => [payload.data.notification, ...prev.slice(0, 4)]);
          }
        }
      } catch (e) {
        // Ignored
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Close notifications popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkNotificationRead = async (id: string, linkUrl?: string | null) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (linkUrl) {
        setNotificationsOpen(false);
        router.push(linkUrl);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper for route breadcrumb
  const getBreadcrumbTitle = () => {
    if (pathname === '/dashboard') return 'Command Center';
    if (pathname.startsWith('/tasks')) return 'Tasks & Issues';
    if (pathname.startsWith('/projects')) return 'Projects & Milestones';
    if (pathname.startsWith('/repositories')) return 'Repositories';
    if (pathname.startsWith('/reviews')) return 'Code Reviews';
    if (pathname.startsWith('/documents')) return 'Documents & Notes';
    if (pathname.startsWith('/collaboration')) return 'Collaboration & Team';
    if (pathname.startsWith('/automations')) return 'Automations & Flow';
    if (pathname.startsWith('/analytics')) return 'Analytics & Telemetry';
    if (pathname.startsWith('/settings/profile')) return 'Operator Identity';
    if (pathname.startsWith('/settings/security')) return 'Security & Credentials';
    if (pathname.startsWith('/settings/sessions')) return 'Active Sessions';
    if (pathname.startsWith('/settings')) return 'Settings Cluster';
    return 'Workspace';
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#FAFAFA] flex selection:bg-[#FAFAFA] selection:text-[#111111]">
      {/* ─── Integrated Collapsible Workspace Sidebar ─── */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        onOpenQuickCapture={() => setQuickCaptureOpen(true)}
        onOpenTerminal={() => setTerminalOpen(true)}
        onOpenDevToken={() => setDevTokenModalOpen(true)}
        onOpenNotifications={() => setNotificationsOpen((prev) => !prev)}
        unreadCount={unreadCount}
        activeFocusSession={activeFocusSession}
      />

      {/* ─── Main Column Viewport ─── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* ─── Top Global Sub-Bar ─── */}
        <header className="sticky top-0 z-20 bg-[#080808]/90 backdrop-blur-md border-b border-[#222222]">
          <div className="w-full px-4 sm:px-6 lg:px-8 h-13 sm:h-14 flex items-center justify-between gap-3">
            {/* Left: Mobile Menu, Sidebar Toggle & Breadcrumbs */}
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Drawer Trigger */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden text-[#737373] hover:text-[#FAFAFA] p-1.5 border border-[#262626] rounded-[2px]"
                aria-label="Open sidebar menu"
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* Desktop Sidebar Quick Toggle (Shows when collapsed or for convenient toggling) */}
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                className="hidden lg:flex items-center justify-center p-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#242424] hover:border-[#3D3D3D] text-[#737373] hover:text-[#FAFAFA] transition-colors"
                title={isSidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
                aria-label="Toggle sidebar"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Breadcrumb Path */}
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-[#555555] uppercase tracking-wider hidden sm:inline">
                  KRONOS
                </span>
                <span className="text-[#333333] hidden sm:inline">/</span>
                <span className="font-semibold text-[#FAFAFA] tracking-wide truncate max-w-[200px] sm:max-w-none">
                  {getBreadcrumbTitle()}
                </span>
              </div>

              {/* Active Focus Session Live Chip */}
              {activeFocusSession && activeFocusSession.status === 'RUNNING' && (
                <Link
                  href="/dashboard"
                  className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#121614] border border-emerald-900/80 hover:border-emerald-600 font-mono text-[10px] text-[#FAFAFA] transition-colors ml-2"
                  title="Active focus session in progress"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400 font-semibold">FOCUS:</span>
                  <span className="truncate max-w-[130px]">{activeFocusSession.title}</span>
                </Link>
              )}
            </div>

            {/* Right: Quick Action Hub & Utilities */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Command Palette Trigger */}
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#242424] hover:border-[#3D3D3D] text-[#737373] hover:text-[#FAFAFA] font-mono text-xs transition-colors"
                title="Search workspace or execute actions (⌘K)"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden md:inline text-[11px]">SEARCH</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-[#1A1A1A] border border-[#2C2C2C] rounded-[2px] text-[#888888]">
                  ⌘K
                </kbd>
              </button>

              {/* Universal Quick Capture Trigger */}
              <button
                type="button"
                onClick={() => setQuickCaptureOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-xs)] bg-[#151515] border border-[#2D2D2D] hover:border-[#FAFAFA] text-[#FAFAFA] font-mono text-xs transition-colors"
                title="Universal Quick Capture (⌘J)"
              >
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline text-[11px]">CAPTURE</span>
              </button>

              {/* Terminal In-App CLI Trigger */}
              <button
                type="button"
                onClick={() => setTerminalOpen(true)}
                className="flex items-center gap-1.5 p-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#242424] hover:border-[#3D3D3D] text-[#737373] hover:text-[#FAFAFA] transition-colors"
                title="In-App Terminal CLI (⌘`)"
              >
                <Terminal className="h-4 w-4" />
              </button>

              {/* Developer CLI Connect Trigger */}
              <button
                type="button"
                onClick={() => setDevTokenModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#242424] hover:border-cyan-500 text-neutral-300 hover:text-white font-mono text-xs transition-colors"
                title="Connect Terminal CLI / Generate Developer Token"
              >
                <Code2 className="h-3.5 w-3.5 text-cyan-400" />
                <span className="hidden lg:inline text-[11px]">CLI TOKEN</span>
              </button>

                            {/* System Verification Checklist Trigger */}
              <Link
                href="/checklist"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-xs)] bg-[#121614] border border-emerald-800/80 hover:border-emerald-500 text-emerald-300 font-mono text-xs transition-colors"
                title="Open Master System Verification Checklist"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden md:inline text-[11px] font-semibold">100% VERIFIED</span>
                <span className="text-[10px] text-neutral-400">CHECKLIST</span>
              </Link>

{/* Notifications Bell Dropdown */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  className="relative p-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#242424] hover:border-[#3D3D3D] text-[#737373] hover:text-[#FAFAFA] transition-colors"
                  title="Notifications"
                  aria-label="View notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#FAFAFA] text-[#080808] font-mono text-[9px] font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Popover */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-[var(--radius-sm)] bg-[#111111] border border-[#2D2D2D] shadow-2xl z-50 animate-fade-in overflow-hidden font-mono">
                    <div className="p-3 border-b border-[#222222] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#FAFAFA]">NOTIFICATIONS</span>
                        <span className="text-[10px] text-[#737373]">({unreadCount} unread)</span>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[10px] text-[#737373] hover:text-[#FAFAFA] flex items-center gap-1 hover:underline"
                        >
                          <Check className="h-3 w-3" />
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-[#1F1F1F]">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[#737373]">
                          No unread notifications.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleMarkNotificationRead(n.id, n.linkUrl)}
                            className="p-3 hover:bg-[#161616] cursor-pointer transition-colors text-left"
                          >
                            <div className="flex items-center justify-between text-[10px] text-[#737373] mb-1">
                              <span className="uppercase text-[#A3A3A3]">{n.type}</span>
                              <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-xs font-medium text-[#FAFAFA] leading-snug">{n.title}</p>
                            <p className="text-[11px] text-[#888888] mt-0.5 leading-normal">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Monogram */}
              <div className="flex items-center pl-2 border-l border-[#222222]">
                <Link
                  href="/settings/profile"
                  className="h-7 w-7 rounded-[var(--radius-xs)] bg-[#151515] border border-[#2D2D2D] hover:border-[#FAFAFA] flex items-center justify-center font-mono text-xs font-bold text-[#FAFAFA] transition-colors"
                  title="Account Settings"
                >
                  {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* ─── Breadcrumb / Section Header Subbar (Optional) ─── */}
        {(headerTitle || pathname.startsWith('/settings')) && (
          <div className="bg-[#0E0E0E] border-b border-[#222222] py-3.5 px-4 sm:px-6 lg:px-8">
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-[#737373] uppercase tracking-widest">
                  <span>SYSTEM</span>
                  <span>/</span>
                  <span className="text-[#FAFAFA]">
                    {pathname.startsWith('/settings') ? 'SETTINGS CLUSTER' : 'AI WORK OS'}
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-semibold text-[#FAFAFA] tracking-tight mt-0.5">
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
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 animate-fade-in flex flex-col">
          {children}
        </main>

        {/* ─── Application Footer ─── */}
        <footer className="border-t border-[#1C1C1C] py-4 px-4 sm:px-6 lg:px-8 text-xs font-mono text-[#666666] bg-[#0A0A0A]">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span>KRONOS AI WORK OPERATING SYSTEM</span>
              <span>•</span>
              <span>SOVEREIGN ARCHITECTURE</span>
            </div>
            <div className="flex items-center gap-6 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                SYNCHRONIZED
              </span>
              <span>TLS 1.3 SECURE</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Global Modals */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNewDocument={() => {
          setCommandPaletteOpen(false);
          router.push('/documents');
        }}
      />

      <UniversalQuickCapture
        isOpen={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        onSuccess={() => {
          setQuickCaptureOpen(false);
        }}
      />

      <TerminalCommandCenter
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
      />

      <DeveloperTokenModal
        isOpen={devTokenModalOpen}
        onClose={() => setDevTokenModalOpen(false)}
      />
    </div>
  );
}

export { AppShell };
