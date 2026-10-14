'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { Card, Button, Badge } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import {
  api,
  API_BASE_URL,
  DailyCommandCenterData,
  FocusSessionItem,
  TaskItem,
} from '@/lib/api';
import {
  Clock,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  FolderKanban,
  FileText,
  Terminal,
  Activity,
  Layers,
  CheckSquare,
  Ban,
  TrendingUp,
  RefreshCw,
  Plus,
} from 'lucide-react';

export default function DailyCommandCenterPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DailyCommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab for today's work
  const [activeTab, setActiveTab] = useState<'due' | 'priorities' | 'overdue' | 'blocked'>('due');

  // Focus Timer local state
  const [focusTitle, setFocusTitle] = useState('Deep Work Sprint');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [isStartingFocus, setIsStartingFocus] = useState(false);
  const [focusActionLoading, setFocusActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getDailyCommandCenter();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load command center data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time task events listener to keep command center fresh
  useEffect(() => {
    const apiBase = API_BASE_URL;
    const eventSource = new EventSource(`${apiBase}/api/tasks/events`, {
      withCredentials: true,
    });

    eventSource.onmessage = () => {
      loadData();
    };

    return () => {
      eventSource.close();
    };
  }, [loadData]);

  // Focus Session Controls
  const handleStartFocus = async (taskId?: string, taskTitle?: string) => {
    setIsStartingFocus(true);
    try {
      const title = taskTitle || focusTitle;
      const res = await api.startFocusSession({
        taskId,
        title,
        targetMinutes: focusMinutes,
      });
      if (res.success && res.data?.session) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStartingFocus(false);
    }
  };

  const handlePauseFocus = async (sessionId: string) => {
    setFocusActionLoading(true);
    try {
      await api.pauseFocusSession(sessionId);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setFocusActionLoading(false);
    }
  };

  const handleResumeFocus = async (sessionId: string) => {
    setFocusActionLoading(true);
    try {
      await api.resumeFocusSession(sessionId);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setFocusActionLoading(false);
    }
  };

  const handleCompleteFocus = async (sessionId: string) => {
    setFocusActionLoading(true);
    try {
      await api.completeFocusSession(sessionId);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setFocusActionLoading(false);
    }
  };

  const handleToggleTaskDone = async (task: TaskItem) => {
    try {
      const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
      await api.updateTask(task.id, { status: nextStatus });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const activeFocus = data?.focusTelemetry?.activeSession;
  const plan = data?.planningAssistant?.suggestedPlan || [];

  return (
    <AppShell
      headerTitle="Daily Command Center"
      headerSubtitle="Integrated operator cockpit: Priorities, Focus, Projects, and AI Intelligence"
    >
      <div className="space-y-8 animate-fade-in font-sans">
        {/* ─── Architectural Hero Banner ─── */}
        <div className="p-6 sm:p-7 rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-grid-pattern opacity-15 pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#151515] border border-[#2D2D2D] font-mono text-[10px] uppercase text-[#FAFAFA]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                SOVEREIGN INTELLIGENCE // REAL-TIME ACTIVE
              </div>

              <h2 className="text-2xl sm:text-3xl font-light text-[#FAFAFA] tracking-tight leading-snug">
                Welcome, <span className="font-semibold">{user?.displayName || 'Operator'}</span>
              </h2>

              <p className="text-xs text-[#737373] leading-relaxed">
                Your workspace graph is fully reconciled. Track deadlines, maintain focus sessions, and execute planned objectives with deterministic consistency.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono">
              <Link href="/tasks">
                <Button variant="outline" size="sm">
                  <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                  Tasks OS
                </Button>
              </Link>
              <Link href="/documents">
                <Button variant="outline" size="sm">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Notes & Docs
                </Button>
              </Link>
              <Link href="/analytics">
                <Button variant="outline" size="sm">
                  <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                  Analytics
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ─── Telemetry KPI Counter Strip ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
          <Card className="p-4 space-y-1 bg-[#0F0F0F]">
            <span className="text-[10px] text-[#737373] uppercase tracking-wider">OPEN TASKS</span>
            <div className="text-2xl font-bold text-[#FAFAFA]">{data?.summary.totalOpenTasks ?? 0}</div>
            <p className="text-[10px] text-[#737373]">ACTIVE WORK ITEMS</p>
          </Card>

          <Card className="p-4 space-y-1 bg-[#0F0F0F]">
            <span className="text-[10px] text-[#737373] uppercase tracking-wider">DUE TODAY</span>
            <div className="text-2xl font-bold text-[#FAFAFA]">{data?.summary.dueTodayCount ?? 0}</div>
            <p className="text-[10px] text-[#737373]">TARGET COMMITTED</p>
          </Card>

          <Card className={`p-4 space-y-1 bg-[#0F0F0F] ${(data?.summary.overdueCount || 0) > 0 ? 'border-red-900/60' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#737373] uppercase tracking-wider">OVERDUE</span>
              {(data?.summary.overdueCount || 0) > 0 && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
            </div>
            <div className={`text-2xl font-bold ${(data?.summary.overdueCount || 0) > 0 ? 'text-red-400' : 'text-[#FAFAFA]'}`}>
              {data?.summary.overdueCount ?? 0}
            </div>
            <p className="text-[10px] text-[#737373]">PAST DEADLINE</p>
          </Card>

          <Card className={`p-4 space-y-1 bg-[#0F0F0F] ${(data?.summary.blockedCount || 0) > 0 ? 'border-amber-900/60' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#737373] uppercase tracking-wider">BLOCKED</span>
              {(data?.summary.blockedCount || 0) > 0 && <Ban className="h-3.5 w-3.5 text-amber-400" />}
            </div>
            <div className={`text-2xl font-bold ${(data?.summary.blockedCount || 0) > 0 ? 'text-amber-400' : 'text-[#FAFAFA]'}`}>
              {data?.summary.blockedCount ?? 0}
            </div>
            <p className="text-[10px] text-[#737373]">AWAITING DEPENDENCY</p>
          </Card>

          <Card className="p-4 space-y-1 bg-[#0F0F0F]">
            <span className="text-[10px] text-[#737373] uppercase tracking-wider">COMPLETED TODAY</span>
            <div className="text-2xl font-bold text-emerald-400">{data?.summary.completedTodayCount ?? 0}</div>
            <p className="text-[10px] text-[#737373]">RESOLVED SPRINT</p>
          </Card>

          <Card className="p-4 space-y-1 bg-[#0F0F0F]">
            <span className="text-[10px] text-[#737373] uppercase tracking-wider">ACTIVE PROJECTS</span>
            <div className="text-2xl font-bold text-[#FAFAFA]">{data?.summary.activeProjectsCount ?? 0}</div>
            <p className="text-[10px] text-[#737373]">STRATEGIC INITIATIVES</p>
          </Card>
        </div>

        {/* ─── Focus Session & AI Planning Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Focus Engine Widget (1 col) */}
          <Card className="p-5 space-y-4 bg-[#111111] border-[#2D2D2D] flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs text-[#FAFAFA]">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold uppercase tracking-wider">FOCUS SESSION MODE</span>
                </div>
                {activeFocus && (
                  <Badge variant={activeFocus.status === 'RUNNING' ? 'default' : 'secondary'}>
                    {activeFocus.status}
                  </Badge>
                )}
              </div>

              {activeFocus ? (
                <div className="p-4 rounded-[var(--radius-xs)] bg-[#161616] border border-[#262626] space-y-3">
                  <div>
                    <span className="text-[10px] font-mono text-[#737373] uppercase">CURRENT OBJECTIVE</span>
                    <h4 className="text-base font-semibold text-[#FAFAFA] leading-snug mt-0.5">
                      {activeFocus.title}
                    </h4>
                    {activeFocus.task && (
                      <p className="text-xs text-[#737373] font-mono mt-1">
                        Task: <span className="text-[#FAFAFA]">{activeFocus.task.title}</span>
                      </p>
                    )}
                  </div>

                  <div className="font-mono text-xs text-[#737373] flex items-center justify-between pt-2 border-t border-[#222222]">
                    <span>TARGET: {activeFocus.targetMinutes}m</span>
                    <span>ELAPSED: {Math.round(activeFocus.actualSeconds / 60)}m</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {activeFocus.status === 'RUNNING' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={focusActionLoading}
                        onClick={() => handlePauseFocus(activeFocus.id)}
                        className="flex-1 font-mono text-xs"
                      >
                        <Pause className="h-3 w-3 mr-1.5" /> Pause
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={focusActionLoading}
                        onClick={() => handleResumeFocus(activeFocus.id)}
                        className="flex-1 font-mono text-xs"
                      >
                        <Play className="h-3 w-3 mr-1.5" /> Resume
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={focusActionLoading}
                      onClick={() => handleCompleteFocus(activeFocus.id)}
                      className="flex-1 font-mono text-xs"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1.5" /> Complete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#737373] leading-relaxed">
                    Start a time-boxed sprint to log verified focus time against your tasks and prevent distractions.
                  </p>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={focusTitle}
                      onChange={(e) => setFocusTitle(e.target.value)}
                      placeholder="Focus Objective Title"
                      className="w-full bg-[#161616] border border-[#2D2D2D] rounded-[var(--radius-xs)] px-3 py-1.5 text-xs text-[#FAFAFA] placeholder-[#555555] font-mono focus:outline-none focus:border-[#FAFAFA]"
                    />

                    <div className="flex items-center gap-2 font-mono text-xs">
                      {[15, 25, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setFocusMinutes(mins)}
                          className={`flex-1 py-1 rounded-[2px] border text-center transition-colors ${
                            focusMinutes === mins
                              ? 'bg-[#FAFAFA] text-[#111111] font-semibold border-[#FAFAFA]'
                              : 'bg-[#151515] text-[#737373] border-[#262626] hover:text-[#FAFAFA]'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    disabled={isStartingFocus}
                    onClick={() => handleStartFocus()}
                    className="font-mono text-xs"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" /> Start {focusMinutes}m Sprint
                  </Button>
                </div>
              )}
            </div>

            {/* Time Tracking Telemetry Summary */}
            <div className="pt-3 border-t border-[#222222] font-mono text-xs flex items-center justify-between text-[#737373]">
              <div>
                <span className="text-[10px] uppercase">TODAY LOGGED</span>
                <p className="text-[#FAFAFA] font-bold text-sm">
                  {data?.focusTelemetry?.todayHours ?? 0}h
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase">WEEK LOGGED</span>
                <p className="text-[#FAFAFA] font-bold text-sm">
                  {data?.focusTelemetry?.weekHours ?? 0}h
                </p>
              </div>
            </div>
          </Card>

          {/* AI Planning Assistant (2 cols) */}
          <Card className="p-5 lg:col-span-2 space-y-4 bg-[#111111] border-[#2D2D2D]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-[#FAFAFA]">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="font-semibold uppercase tracking-wider">AI DAILY PLANNING ASSISTANT</span>
              </div>
              <div className="font-mono text-[11px] text-[#737373]">
                {data?.planningAssistant?.totalPlannedMinutes ? `~${Math.round(data.planningAssistant.totalPlannedMinutes / 60)}h ${data.planningAssistant.totalPlannedMinutes % 60}m planned` : 'Real-time schedule'}
              </div>
            </div>

            <p className="text-xs text-[#737373]">
              Deterministic recommendation based on overdue deadlines, DAG dependencies, unblocking impact, and strategic priorities.
            </p>

            <div className="space-y-2">
              {plan.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#737373] font-mono border border-dashed border-[#262626] rounded-[var(--radius-xs)]">
                  All today's tasks and overdue items resolved. Clean slate.
                </div>
              ) : (
                plan.map((item, index) => (
                  <div
                    key={item.taskId}
                    className="p-3 rounded-[var(--radius-xs)] bg-[#151515] border border-[#262626] hover:border-[#404040] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left font-mono"
                  >
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#737373]">#{index + 1}</span>
                        <Badge variant={item.priority === 'URGENT' ? 'default' : 'secondary'}>
                          {item.priority}
                        </Badge>
                        {item.projectName && (
                          <span className="text-[10px] text-[#737373] truncate">📁 {item.projectName}</span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-[#FAFAFA] font-sans">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-[#888888] flex items-center gap-1">
                        <span>💡</span>
                        <span>{item.rationale}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[#737373]">{item.estimatedMinutes}m est</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartFocus(item.taskId, item.title)}
                        className="text-[11px] h-7 px-2.5"
                      >
                        <Play className="h-3 w-3 mr-1" /> Focus
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* ─── Today's Work Center (Tabs: Due Today / Priorities / Overdue / Blocked) ─── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222222] pb-3">
            <div className="flex items-center gap-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('due')}
                className={`px-3 py-1.5 rounded-[var(--radius-xs)] transition-colors flex items-center gap-1.5 ${
                  activeTab === 'due'
                    ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D] font-semibold'
                    : 'text-[#737373] hover:text-[#FAFAFA]'
                }`}
              >
                <span>DUE TODAY</span>
                <span className="text-[10px] px-1 bg-[#222222] rounded-[2px]">{data?.dueTodayTasks.length ?? 0}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('priorities')}
                className={`px-3 py-1.5 rounded-[var(--radius-xs)] transition-colors flex items-center gap-1.5 ${
                  activeTab === 'priorities'
                    ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D] font-semibold'
                    : 'text-[#737373] hover:text-[#FAFAFA]'
                }`}
              >
                <span>PRIORITIES</span>
                <span className="text-[10px] px-1 bg-[#222222] rounded-[2px]">{data?.todayPriorities.length ?? 0}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('overdue')}
                className={`px-3 py-1.5 rounded-[var(--radius-xs)] transition-colors flex items-center gap-1.5 ${
                  activeTab === 'overdue'
                    ? 'bg-[#151515] text-red-400 border border-red-900/60 font-semibold'
                    : 'text-[#737373] hover:text-[#FAFAFA]'
                }`}
              >
                <span>OVERDUE</span>
                <span className="text-[10px] px-1 bg-[#222222] rounded-[2px] text-red-400">{data?.overdueTasks.length ?? 0}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('blocked')}
                className={`px-3 py-1.5 rounded-[var(--radius-xs)] transition-colors flex items-center gap-1.5 ${
                  activeTab === 'blocked'
                    ? 'bg-[#151515] text-amber-400 border border-amber-900/60 font-semibold'
                    : 'text-[#737373] hover:text-[#FAFAFA]'
                }`}
              >
                <span>BLOCKED</span>
                <span className="text-[10px] px-1 bg-[#222222] rounded-[2px] text-amber-400">{data?.blockedTasks.length ?? 0}</span>
              </button>
            </div>

            <Link href="/tasks" className="font-mono text-xs text-[#737373] hover:text-[#FAFAFA] flex items-center gap-1">
              <span>View full board</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Tab Work Items List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
            {(() => {
              const currentList =
                activeTab === 'due'
                  ? data?.dueTodayTasks || []
                  : activeTab === 'priorities'
                  ? data?.todayPriorities || []
                  : activeTab === 'overdue'
                  ? data?.overdueTasks || []
                  : data?.blockedTasks || [];

              if (currentList.length === 0) {
                return (
                  <div className="col-span-2 p-8 text-center text-xs text-[#737373] border border-dashed border-[#222222] rounded-[var(--radius-sm)]">
                    No items in this queue. All targets clear.
                  </div>
                );
              }

              return currentList.map((task) => (
                <div
                  key={task.id}
                  className="p-3.5 rounded-[var(--radius-xs)] bg-[#101010] border border-[#242424] hover:border-[#383838] transition-colors flex items-start justify-between gap-3 text-left"
                >
                  <div className="flex items-start gap-3 max-w-[80%]">
                    <button
                      type="button"
                      onClick={() => handleToggleTaskDone(task)}
                      className={`mt-0.5 h-4 w-4 rounded-[2px] border flex items-center justify-center transition-colors ${
                        task.status === 'DONE'
                          ? 'bg-[#FAFAFA] border-[#FAFAFA] text-[#111111]'
                          : 'border-[#404040] hover:border-[#FAFAFA]'
                      }`}
                      aria-label="Toggle complete"
                    >
                      {task.status === 'DONE' && <CheckSquare className="h-3 w-3" />}
                    </button>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-[#737373]">{task.id.slice(0, 8)}</span>
                        <Badge variant={task.priority === 'URGENT' ? 'default' : 'secondary'}>
                          {task.priority}
                        </Badge>
                        {task.isBlocked && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded-[2px] border border-amber-900/60">
                            <Ban className="h-2.5 w-2.5" /> BLOCKED
                          </span>
                        )}
                        {task.project && (
                          <span className="text-[10px] text-[#737373]">📁 {task.project.name}</span>
                        )}
                      </div>

                      <h4 className={`text-xs font-semibold font-sans ${task.status === 'DONE' ? 'line-through text-[#666666]' : 'text-[#FAFAFA]'}`}>
                        {task.title}
                      </h4>

                      {task.dueDate && (
                        <p className="text-[10px] text-[#737373] flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartFocus(task.id, task.title)}
                    className="h-7 px-2 shrink-0 text-[11px]"
                    title="Start focus timer on this task"
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ─── Active Projects & Knowledge Hub Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Projects Telemetry */}
          <Card className="p-5 space-y-4 bg-[#111111] border-[#2D2D2D]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-[#FAFAFA]">
                <FolderKanban className="h-4 w-4 text-[#FAFAFA]" />
                <span className="font-semibold uppercase tracking-wider">ACTIVE INITIATIVES & PROGRESS</span>
              </div>
              <Link href="/tasks" className="font-mono text-[11px] text-[#737373] hover:text-[#FAFAFA] flex items-center gap-1">
                <span>Manage</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-3 font-mono">
              {!data?.activeProjects || data.activeProjects.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#737373] border border-dashed border-[#222222] rounded-[var(--radius-xs)]">
                  No active projects currently configured.
                </div>
              ) : (
                data.activeProjects.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-[var(--radius-xs)] bg-[#151515] border border-[#242424] space-y-2 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || '#FAFAFA' }} />
                        <h4 className="text-xs font-semibold text-[#FAFAFA]">{p.name}</h4>
                      </div>
                      <Badge
                        variant={
                          p.health === 'ON_TRACK'
                            ? 'success'
                            : p.health === 'AT_RISK'
                            ? 'warning'
                            : 'destructive'
                        }
                      >
                        {p.health.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Calculated Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#737373]">
                        <span>PROGRESS</span>
                        <span>{p.progress}% ({p.doneTasks}/{p.totalTasks} tasks)</span>
                      </div>
                      <div className="w-full bg-[#202020] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#FAFAFA] h-full transition-all duration-300"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Knowledge & Recent Notes Hub */}
          <Card className="p-5 space-y-4 bg-[#111111] border-[#2D2D2D]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-[#FAFAFA]">
                <FileText className="h-4 w-4 text-[#FAFAFA]" />
                <span className="font-semibold uppercase tracking-wider">RECENT KNOWLEDGE & NOTES</span>
              </div>
              <Link href="/documents" className="font-mono text-[11px] text-[#737373] hover:text-[#FAFAFA] flex items-center gap-1">
                <span>All documents</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2.5 font-mono">
              {!data?.recentNotes || data.recentNotes.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#737373] border border-dashed border-[#222222] rounded-[var(--radius-xs)]">
                  No recent notes found. Use quick capture or create a document.
                </div>
              ) : (
                data.recentNotes.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents?id=${doc.id}`}
                    className="p-3 rounded-[var(--radius-xs)] bg-[#151515] border border-[#242424] hover:border-[#404040] transition-colors flex items-center justify-between gap-3 text-left block"
                  >
                    <div className="space-y-0.5 truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{doc.icon || '📄'}</span>
                        <h4 className="text-xs font-semibold text-[#FAFAFA] truncate">{doc.title}</h4>
                      </div>
                      {doc.snippet && (
                        <p className="text-[11px] text-[#737373] truncate font-sans pl-5">
                          {doc.snippet}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[#737373] shrink-0">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
