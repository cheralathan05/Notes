'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/app-shell';
import { Card, Button, Badge } from '@/components/ui';
import {
  api,
  WorkspaceAnalyticsData,
  GoalItem,
  TimeEntryItem,
} from '@/lib/api';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  X,
  Layers,
  Activity,
} from 'lucide-react';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<WorkspaceAnalyticsData | null>(null);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Goal modal
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState('Strategic');
  const [newGoalTarget, setNewGoalTarget] = useState(100);
  const [newGoalUnit, setNewGoalUnit] = useState('%');
  const [newGoalDate, setNewGoalDate] = useState('');
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);

  // Check-In modal
  const [checkInGoal, setCheckInGoal] = useState<GoalItem | null>(null);
  const [checkInValue, setCheckInValue] = useState<number>(0);
  const [checkInNote, setCheckInNote] = useState('');
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [analyticsRes, goalsRes, timeRes] = await Promise.all([
        api.getWorkspaceAnalytics(),
        api.getGoals(),
        api.getTimeEntries(),
      ]);

      if (analyticsRes.success && analyticsRes.data) {
        setAnalytics(analyticsRes.data);
      }
      if (goalsRes.success && goalsRes.data?.goals) {
        setGoals(goalsRes.data.goals);
      }
      if (timeRes.success && timeRes.data?.entries) {
        setTimeEntries(timeRes.data.entries);
      }
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    setIsCreatingGoal(true);
    try {
      const res = await api.createGoal({
        title: newGoalTitle.trim(),
        category: newGoalCategory,
        targetValue: newGoalTarget,
        unit: newGoalUnit,
        targetDate: newGoalDate || undefined,
      });

      if (res.success && res.data?.goal) {
        setIsGoalModalOpen(false);
        setNewGoalTitle('');
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingGoal(false);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInGoal) return;

    setIsSubmittingCheckIn(true);
    try {
      const res = await api.checkInGoal(checkInGoal.id, {
        newValue: checkInValue,
        note: checkInNote.trim() || undefined,
      });

      if (res.success) {
        setCheckInGoal(null);
        setCheckInNote('');
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const summary = analytics?.summary;

  return (
    <AppShell
      headerTitle="Analytics & Strategic Intelligence"
      headerSubtitle="Real-time execution velocity, cycle times, OKRs, and time distribution"
    >
      <div className="space-y-8 animate-fade-in font-sans">
        {/* ─── Hero KPI Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <Card className="p-5 space-y-2 bg-[#101010]">
            <div className="flex items-center justify-between text-xs text-[#737373]">
              <span>COMPLETION RATE</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-[#FAFAFA]">
              {summary?.completionRate ?? 0}%
            </div>
            <p className="text-[11px] text-[#737373]">
              {summary?.completedTasks ?? 0} of {summary?.totalTasks ?? 0} tasks resolved
            </p>
          </Card>

          <Card className="p-5 space-y-2 bg-[#101010]">
            <div className="flex items-center justify-between text-xs text-[#737373]">
              <span>AVG CYCLE TIME</span>
              <Clock className="h-4 w-4 text-[#FAFAFA]" />
            </div>
            <div className="text-3xl font-bold text-[#FAFAFA]">
              {summary?.averageCycleHours ?? 0}h
            </div>
            <p className="text-[11px] text-[#737373]">From creation to DONE status</p>
          </Card>

          <Card className="p-5 space-y-2 bg-[#101010]">
            <div className="flex items-center justify-between text-xs text-[#737373]">
              <span>7-DAY VELOCITY</span>
              <TrendingUp className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#FAFAFA]">
                {summary?.velocityLast7Days ?? 0}
              </span>
              <span
                className={`text-xs flex items-center ${
                  (summary?.velocityTrend ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {(summary?.velocityTrend ?? 0) >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {summary?.velocityTrend ?? 0} vs prev week
              </span>
            </div>
            <p className="text-[11px] text-[#737373]">Tasks closed in rolling 7 days</p>
          </Card>

          <Card className="p-5 space-y-2 bg-[#101010]">
            <div className="flex items-center justify-between text-xs text-[#737373]">
              <span>OVERDUE RATIO</span>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-3xl font-bold text-red-400">
              {summary?.overdueRate ?? 0}%
            </div>
            <p className="text-[11px] text-[#737373]">{summary?.overdueCount ?? 0} tasks currently overdue</p>
          </Card>
        </div>

        {/* ─── Workflow Distributions ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Breakdown */}
          <Card className="p-5 space-y-4 bg-[#111111] border-[#2D2D2D]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-[#FAFAFA]">
                <Layers className="h-4 w-4 text-[#FAFAFA]" />
                <span className="font-semibold uppercase tracking-wider">WORKFLOW STATUS DISTRIBUTION</span>
              </div>
            </div>

            <div className="space-y-3 font-mono">
              {analytics?.statusDistribution &&
                Object.entries(analytics.statusDistribution).map(([status, count]) => {
                  const total = summary?.totalTasks || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#A3A3A3]">{status}</span>
                        <span className="text-[#FAFAFA] font-bold">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-[#202020] h-2 rounded-[2px] overflow-hidden">
                        <div
                          className="bg-[#FAFAFA] h-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          {/* Priority Breakdown */}
          <Card className="p-5 space-y-4 bg-[#111111] border-[#2D2D2D]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-[#FAFAFA]">
                <Activity className="h-4 w-4 text-[#FAFAFA]" />
                <span className="font-semibold uppercase tracking-wider">PRIORITY CLASSIFICATION</span>
              </div>
            </div>

            <div className="space-y-3 font-mono">
              {analytics?.priorityDistribution &&
                Object.entries(analytics.priorityDistribution).map(([priority, count]) => {
                  const total = summary?.totalTasks || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={priority} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#A3A3A3]">{priority}</span>
                        <span className="text-[#FAFAFA] font-bold">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-[#202020] h-2 rounded-[2px] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            priority === 'URGENT'
                              ? 'bg-red-500'
                              : priority === 'HIGH'
                              ? 'bg-amber-400'
                              : 'bg-[#FAFAFA]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>

        {/* ─── Strategic Goals & OKRs Hub ─── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222222] pb-3">
            <div>
              <h3 className="text-base font-semibold text-[#FAFAFA] tracking-tight">
                Strategic Goals & Objective Key Results (OKRs)
              </h3>
              <p className="text-xs text-[#737373]">
                Measurable target outcomes linked to project execution and key delivery milestones.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsGoalModalOpen(true)}
              className="font-mono text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Goal
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
            {goals.length === 0 ? (
              <div className="col-span-3 p-10 text-center text-xs text-[#737373] border border-dashed border-[#262626] rounded-[var(--radius-sm)]">
                No strategic goals configured. Define objectives to track organizational progress.
              </div>
            ) : (
              goals.map((goal) => (
                <Card
                  key={goal.id}
                  className="p-4 space-y-3 bg-[#111111] border-[#262626] flex flex-col justify-between text-left"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#737373] uppercase tracking-wider">
                        {goal.category}
                      </span>
                      <Badge
                        variant={
                          goal.status === 'ACHIEVED'
                            ? 'success'
                            : goal.status === 'AT_RISK'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {goal.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <h4 className="text-xs font-semibold text-[#FAFAFA] font-sans leading-snug">
                      {goal.title}
                    </h4>

                    {goal.description && (
                      <p className="text-[11px] text-[#737373] line-clamp-2 font-sans">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#1F1F1F]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#737373]">PROGRESS</span>
                        <span className="text-[#FAFAFA] font-bold">
                          {goal.currentValue} / {goal.targetValue} {goal.unit} ({goal.progressPercentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-[#202020] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            goal.status === 'ACHIEVED' ? 'bg-emerald-400' : 'bg-[#FAFAFA]'
                          }`}
                          style={{ width: `${goal.progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-[#737373]">
                        {goal.targetDate ? `Due: ${new Date(goal.targetDate).toLocaleDateString()}` : 'Ongoing'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCheckInGoal(goal);
                          setCheckInValue(goal.currentValue);
                        }}
                        className="text-[10px] h-6 px-2"
                      >
                        Check In
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* ─── Recent Verified Time Entries ─── */}
        <div className="space-y-4">
          <div className="border-b border-[#222222] pb-3">
            <h3 className="text-base font-semibold text-[#FAFAFA] tracking-tight">
              Verified Time Tracking Entries
            </h3>
            <p className="text-xs text-[#737373]">
              Durable records generated from focus sessions and manual operational logging.
            </p>
          </div>

          <div className="p-4 rounded-[var(--radius-sm)] bg-[#101010] border border-[#242424] font-mono text-xs overflow-x-auto">
            {timeEntries.length === 0 ? (
              <div className="text-center py-6 text-[#737373]">No time entries logged yet.</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#222222] text-[#737373] text-[10px] uppercase">
                    <th className="pb-2">DESCRIPTION</th>
                    <th className="pb-2">TASK / PROJECT</th>
                    <th className="pb-2">DURATION</th>
                    <th className="pb-2">TYPE</th>
                    <th className="pb-2 text-right">TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {timeEntries.slice(0, 8).map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#151515] transition-colors">
                      <td className="py-2.5 font-medium text-[#FAFAFA]">{entry.description}</td>
                      <td className="py-2.5 text-[#737373]">
                        {entry.task?.title || entry.project?.name || '—'}
                      </td>
                      <td className="py-2.5 text-[#FAFAFA] font-bold">
                        {Math.round(entry.durationSeconds / 60)} mins
                      </td>
                      <td className="py-2.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-[2px] bg-[#181818] border border-[#2B2B2B] text-[#A3A3A3]">
                          {entry.isManual ? 'MANUAL' : 'FOCUS SPRINT'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[#737373]">
                        {new Date(entry.startedAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ─── Create Goal Modal ─── */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121212] border border-[#2D2D2D] rounded-[var(--radius-sm)] p-6 space-y-4 font-mono shadow-2xl animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <h3 className="text-sm font-semibold text-[#FAFAFA]">NEW STRATEGIC GOAL</h3>
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
                className="text-[#737373] hover:text-[#FAFAFA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] text-[#737373]">GOAL TITLE *</label>
                <input
                  type="text"
                  required
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  placeholder="e.g. Reduce mean time to recovery by 50%"
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] placeholder-[#555555] focus:outline-none focus:border-[#FAFAFA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#737373]">TARGET VALUE</label>
                  <input
                    type="number"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#737373]">UNIT</label>
                  <input
                    type="text"
                    value={newGoalUnit}
                    onChange={(e) => setNewGoalUnit(e.target.value)}
                    placeholder="%, ms, users"
                    className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#737373]">CATEGORY</label>
                <select
                  value={newGoalCategory}
                  onChange={(e) => setNewGoalCategory(e.target.value)}
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                >
                  <option value="Strategic">Strategic</option>
                  <option value="Performance">Performance</option>
                  <option value="Product">Product</option>
                  <option value="Operational">Operational</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#737373]">TARGET DATE</label>
                <input
                  type="date"
                  value={newGoalDate}
                  onChange={(e) => setNewGoalDate(e.target.value)}
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsGoalModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isCreatingGoal}
                >
                  Create Goal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Check-In Modal ─── */}
      {checkInGoal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121212] border border-[#2D2D2D] rounded-[var(--radius-sm)] p-5 space-y-4 font-mono shadow-2xl animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <div>
                <h3 className="text-xs font-semibold text-[#FAFAFA]">GOAL CHECK-IN</h3>
                <p className="text-[10px] text-[#737373] truncate max-w-[220px]">{checkInGoal.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setCheckInGoal(null)}
                className="text-[#737373] hover:text-[#FAFAFA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-[#737373]">
                  NEW VALUE ({checkInGoal.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={checkInValue}
                  onChange={(e) => setCheckInValue(Number(e.target.value))}
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[#737373]">PROGRESS NOTE</label>
                <textarea
                  rows={2}
                  value={checkInNote}
                  onChange={(e) => setCheckInNote(e.target.value)}
                  placeholder="Key accomplishments or blockers..."
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] placeholder-[#555555] focus:outline-none focus:border-[#FAFAFA]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCheckInGoal(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingCheckIn}
                >
                  Save Check-In
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
