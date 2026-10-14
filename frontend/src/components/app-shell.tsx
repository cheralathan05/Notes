'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { BrandWordmark, Button } from './ui';
import { CommandPalette } from '@/components/documents/command-palette';
import { UniversalQuickCapture } from '@/components/documents/universal-quick-capture';
import { TerminalCommandCenter } from '@/components/tasks/terminal-command-center';
import { DeveloperTokenModal } from '@/components/developer/developer-token-modal';
import { api, API_BASE_URL, NotificationItem, FocusSessionItem } from '@/lib/api';
import {
  LayoutDashboard,
  User,
  Shield,
  Layers,
  LogOut,
  Menu,
  X,
  FileText,
  CheckSquare,
  BarChart3,
  Cpu,
  Bell,
  Search,
  Zap,
  Terminal,
  Clock,
  Check,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Code2,
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navItems = [
    { label: 'COMMAND CENTER', href: '/dashboard', icon: LayoutDashboard },
    { label: 'TASKS & PROJECTS', href: '/tasks', icon: CheckSquare },
    { label: 'REPOSITORIES', href: '/repositories', icon: GitBranch },
    { label: 'DOCUMENTS & NOTES', href: '/documents', icon: FileText },
    { label: 'ANALYTICS & GOALS', href: '/analytics', icon: BarChart3 },
    { label: 'AUTOMATIONS', href: '/automations', icon: Cpu },
  ];

  // Global Keyboard Shortcuts (Cmd+K for Command Palette, Cmd+J for Quick Capture, Cmd+` for Terminal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setQuickCaptureOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
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

  return (
    <div className="min-h-screen bg-[#080808] text-[#FAFAFA] flex flex-col selection:bg-[#FAFAFA] selection:text-[#111111]">
      {/* ─── Top Global Navigation ─── */}
      <header className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur-md border-b border-[#2D2D2D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Left: Brand & Telemetry */}
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="transition-opacity hover:opacity-85">
              <BrandWordmark size="sm" subtitle="" />
            </Link>

            {/* Active Focus Session Chip */}
            {activeFocusSession && activeFocusSession.status === 'RUNNING' && (
              <Link
                href="/dashboard"
                className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#121212] border border-[#2D2D2D] hover:border-[#FAFAFA] font-mono text-[10px] text-[#FAFAFA] transition-colors"
                title="Active focus session in progress"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[#737373]">FOCUS:</span>
                <span className="font-semibold truncate max-w-[120px]">{activeFocusSession.title}</span>
              </Link>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
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

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2.5">
            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#2D2D2D] hover:border-[#404040] text-[#737373] hover:text-[#FAFAFA] font-mono text-xs transition-colors"
              title="Search workspace or execute actions (⌘K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px]">SEARCH</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-[#1A1A1A] border border-[#333333] rounded-[2px] text-[#A3A3A3]">
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
              className="flex items-center gap-1.5 p-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#2D2D2D] hover:border-[#404040] text-[#737373] hover:text-[#FAFAFA] transition-colors"
              title="In-App Terminal CLI (⌘`)"
            >
              <Terminal className="h-4 w-4" />
            </button>

            {/* Developer CLI Connect Trigger */}
            <button
              type="button"
              onClick={() => setDevTokenModalOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#2D2D2D] hover:border-cyan-500 text-neutral-300 hover:text-white font-mono text-xs transition-colors"
              title="Connect Terminal CLI / Generate Developer Token"
            >
              <Code2 className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden md:inline text-[11px]">CLI TOKEN</span>
            </button>

            {/* Notifications Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative p-1.5 rounded-[var(--radius-xs)] bg-[#121212] border border-[#2D2D2D] hover:border-[#404040] text-[#737373] hover:text-[#FAFAFA] transition-colors"
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

            {/* User Profile Monogram & Sign Out */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#222222]">
              <Link
                href="/settings/profile"
                className="h-7 w-7 rounded-[var(--radius-xs)] bg-[#151515] border border-[#2D2D2D] hover:border-[#FAFAFA] flex items-center justify-center font-mono text-xs font-bold text-[#FAFAFA] transition-colors"
                title="Account Settings"
              >
                {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
              </Link>
            </div>

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-[#737373] hover:text-[#FAFAFA] p-1.5 border border-[#2D2D2D] rounded-[2px]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-[#2D2D2D] bg-[#101010] p-4 space-y-3 animate-slide-down">
            <div className="flex items-center gap-3 pb-3 border-b border-[#222222]">
              <div className="h-8 w-8 rounded-[var(--radius-xs)] bg-[#151515] border border-[#2D2D2D] flex items-center justify-center font-mono text-sm font-bold text-[#FAFAFA]">
                {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
              </div>
              <div>
                <p className="text-xs font-medium text-[#FAFAFA]">{user?.displayName}</p>
                <p className="text-[10px] font-mono text-[#737373]">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1 font-mono">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-[var(--radius-xs)] text-xs ${
                      isActive
                        ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]'
                        : 'text-[#737373] hover:bg-[#151515] hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-2 border-t border-[#222222] grid grid-cols-3 gap-1">
                <Link
                  href="/settings/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-center text-[10px] text-[#737373] hover:text-[#FAFAFA]"
                >
                  PROFILE
                </Link>
                <Link
                  href="/settings/security"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-center text-[10px] text-[#737373] hover:text-[#FAFAFA]"
                >
                  SECURITY
                </Link>
                <Link
                  href="/settings/sessions"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-center text-[10px] text-[#737373] hover:text-[#FAFAFA]"
                >
                  SESSIONS
                </Link>
              </div>
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
        <div className="bg-[#101010] border-b border-[#2D2D2D] py-3.5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] text-[#737373] uppercase tracking-widest">
                <span>SYSTEM</span>
                <span>/</span>
                <span className="text-[#FAFAFA]">
                  {pathname.startsWith('/settings') ? 'SETTINGS CLUSTER' : 'AI WORK OS'}
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
      <footer className="border-t border-[#1F1F1F] py-5 px-4 sm:px-6 lg:px-8 text-xs font-mono text-[#737373]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>KRONOS AI WORK OPERATING SYSTEM</span>
            <span>•</span>
            <span>SOVEREIGN ARCHITECTURE</span>
          </div>
          <div className="flex items-center gap-6">
            <span>STATUS: SYNCHRONIZED</span>
            <span>TLS 1.3 / SECURE</span>
          </div>
        </div>
      </footer>

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
