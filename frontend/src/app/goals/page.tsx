'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, GoalItem, KeyResultItem, GoalMetricsData } from '@/lib/api';
import { useWorkspace } from '@/context/workspace-context';
import {
  Target,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  FolderKanban,
  Calendar,
  MoreVertical,
  Trash2,
  Edit3,
  Check,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Percent,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  User,
  X,
  Layers,
  History,
  AlertCircle,
} from 'lucide-react';

export default function GoalsPage() {
  const { currentWorkspace } = useWorkspace();
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [metrics, setMetrics] = useState<GoalMetricsData>({
    totalGoals: 0,
    achievedGoals: 0,
    inProgressGoals: 0,
    atRiskGoals: 0,
    averageProgress: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'progress-desc' | 'progress-asc' | 'date' | 'created'>('created');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddKrModal, setShowAddKrModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalItem | null>(null);
  const [selectedKr, setSelectedKr] = useState<KeyResultItem | null>(null);

  // Create Objective form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('Engineering');
  const [newTimePeriod, setNewTimePeriod] = useState('Q4 2026');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [initialKrs, setInitialKrs] = useState<Array<{
    title: string;
    type: 'INCREASE' | 'DECREASE' | 'BINARY' | 'MILESTONE';
    startValue: number;
    targetValue: number;
    unit: string;
  }>>([
    { title: '', type: 'INCREASE', startValue: 0, targetValue: 100, unit: '%' },
  ]);

  // Add Key Result form state
  const [krTitle, setKrTitle] = useState('');
  const [krDescription, setKrDescription] = useState('');
  const [krType, setKrType] = useState<'INCREASE' | 'DECREASE' | 'BINARY' | 'MILESTONE'>('INCREASE');
  const [krStartValue, setKrStartValue] = useState(0);
  const [krTargetValue, setKrTargetValue] = useState(100);
  const [krCurrentValue, setKrCurrentValue] = useState(0);
  const [krUnit, setKrUnit] = useState('%');
  const [krWeight, setKrWeight] = useState(1.0);

  // Check-in state
  const [checkInNewValue, setCheckInNewValue] = useState<number>(0);
  const [checkInNote, setCheckInNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Record<string, boolean>>({});

  const fetchGoalsAndMetrics = async () => {
    setIsLoading(true);
    try {
      const [goalsRes, metricsRes] = await Promise.all([
        api.getGoals({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          search: searchQuery.trim() || undefined,
        }),
        api.getGoalMetrics().catch(() => null),
      ]);

      if (goalsRes?.success && goalsRes?.data?.goals) {
        setGoals(goalsRes.data.goals);
      }

      if (metricsRes?.success && metricsRes?.data) {
        setMetrics(metricsRes.data);
      }
    } catch (err) {
      console.error('Failed to load goals & metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoalsAndMetrics();
  }, [currentWorkspace?.id, statusFilter, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGoalsAndMetrics();
  };

  const handleCreateObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const validKrs = initialKrs.filter((kr) => kr.title.trim() !== '');

      const res = await api.createGoal({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        category: newCategory,
        timePeriod: newTimePeriod,
        targetDate: newTargetDate || undefined,
        targetValue: 100,
        currentValue: 0,
        unit: '%',
        keyResults: validKrs.length > 0 ? validKrs : undefined,
      });

      if (res.success) {
        setShowCreateModal(false);
        setNewTitle('');
        setNewDescription('');
        setNewTargetDate('');
        setInitialKrs([{ title: '', type: 'INCREASE', startValue: 0, targetValue: 100, unit: '%' }]);
        await fetchGoalsAndMetrics();
      }
    } catch (err) {
      console.error('Failed to create goal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddKeyResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !krTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await api.addKeyResult(selectedGoal.id, {
        title: krTitle.trim(),
        description: krDescription.trim() || undefined,
        type: krType,
        startValue: Number(krStartValue),
        targetValue: Number(krTargetValue),
        currentValue: Number(krCurrentValue),
        unit: krUnit,
        weight: Number(krWeight),
      });

      if (res.success) {
        setShowAddKrModal(false);
        setKrTitle('');
        setKrDescription('');
        setKrStartValue(0);
        setKrTargetValue(100);
        setKrCurrentValue(0);
        setKrUnit('%');
        await fetchGoalsAndMetrics();
      }
    } catch (err) {
      console.error('Failed to add key result:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyResultCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKr || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await api.updateKeyResult(selectedKr.id, {
        newValue: Number(checkInNewValue),
        note: checkInNote.trim() || undefined,
      });

      if (res.success) {
        setShowCheckInModal(false);
        setSelectedKr(null);
        setCheckInNote('');
        await fetchGoalsAndMetrics();
      }
    } catch (err) {
      console.error('Failed to check in key result:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this objective and its key results?')) return;
    try {
      const res = await api.deleteGoal(id);
      if (res.success) {
        await fetchGoalsAndMetrics();
      }
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  };

  const handleDeleteKeyResult = async (krId: string) => {
    if (!window.confirm('Are you sure you want to delete this key result?')) return;
    try {
      const res = await api.deleteKeyResult(krId);
      if (res.success) {
        await fetchGoalsAndMetrics();
      }
    } catch (err) {
      console.error('Failed to delete key result:', err);
    }
  };

  const toggleExpandGoal = (id: string) => {
    setExpandedGoalIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Direction-Aware Progress Calculation Helper for UI
  const computeKrProgress = (type: string, start: number, target: number, current: number) => {
    let raw = 0;
    if (type === 'INCREASE') {
      raw = target === start ? (current >= target ? 100 : 0) : ((current - start) / (target - start)) * 100;
    } else if (type === 'DECREASE') {
      raw = start === target ? (current <= target ? 100 : 0) : ((start - current) / (start - target)) * 100;
    } else if (type === 'BINARY') {
      raw = current >= 1 ? 100 : 0;
    } else if (type === 'MILESTONE') {
      raw = target > 0 ? (current / target) * 100 : 0;
    }
    return Math.max(0, Math.min(100, Math.round(isNaN(raw) ? 0 : raw)));
  };

  // Sort Goals
  const sortedGoals = [...goals].sort((a, b) => {
    if (sortBy === 'progress-desc') return (b.progressPercentage || 0) - (a.progressPercentage || 0);
    if (sortBy === 'progress-asc') return (a.progressPercentage || 0) - (b.progressPercentage || 0);
    if (sortBy === 'date') return new Date(a.targetDate || '9999').getTime() - new Date(b.targetDate || '9999').getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#080808] text-zinc-100 font-sans p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
        {/* ─── Top Header & Primary Action ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Target className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold font-mono tracking-tight text-zinc-100">
                Strategic Goals & OKRs
              </h1>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-1">
              Set high-leverage measurable key results, align teams, and track verified company progress.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold transition-all shadow-lg shadow-emerald-950/40"
            >
              <Plus className="h-4 w-4" />
              <span>Create Objective</span>
            </button>
          </div>
        </div>

        {/* ─── KPI Telemetry Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>Total Objectives</span>
              <Target className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-100">{metrics.totalGoals}</div>
            <div className="text-[11px] text-zinc-500 font-mono">Active in workspace</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>Achieved OKRs</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{metrics.achievedGoals}</div>
            <div className="text-[11px] text-emerald-500/80 font-mono">100% completion verified</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>In Progress</span>
              <Clock className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-blue-400">{metrics.inProgressGoals}</div>
            <div className="text-[11px] text-zinc-500 font-mono">Actively gaining progress</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>At Risk</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400">{metrics.atRiskGoals}</div>
            <div className="text-[11px] text-amber-500/80 font-mono">Needs intervention</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
              <span>Average Progress</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{metrics.averageProgress}%</div>
            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, metrics.averageProgress)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ─── Filters & Search Toolbar ─── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-zinc-500 mr-1">Status:</span>
            {['ALL', 'IN_PROGRESS', 'ACHIEVED', 'AT_RISK', 'NOT_STARTED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                  statusFilter === s
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search form */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Search objectives..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg pl-7 pr-3 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700 w-44 sm:w-52"
              />
              <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-2 top-2" />
            </form>

            {/* Category */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-300 font-mono focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="Strategic">Strategic</option>
              <option value="Engineering">Engineering</option>
              <option value="Product">Product</option>
              <option value="Security">Security</option>
              <option value="Design">Design</option>
              <option value="Operations">Operations</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-300 font-mono focus:outline-none"
            >
              <option value="created">Recently Created</option>
              <option value="progress-desc">Progress: High → Low</option>
              <option value="progress-asc">Progress: Low → High</option>
              <option value="date">Due Date</option>
            </select>
          </div>
        </div>

        {/* ─── Goals & Key Results Grid ─── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-2">
            <div className="h-6 w-6 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin" />
            <span className="text-xs font-mono">Loading verified OKR telemetry...</span>
          </div>
        ) : sortedGoals.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
            <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 font-mono">No Objectives Found</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                Establish high-impact key results for your team to track quarterly performance.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold transition-all"
            >
              Create Your First Objective
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sortedGoals.map((goal) => {
              const progress = Math.min(100, Math.round(goal.progressPercentage || 0));
              const isAchieved = goal.status === 'ACHIEVED' || progress >= 100;
              const isAtRisk = goal.status === 'AT_RISK';
              const isExpanded = expandedGoalIds[goal.id] ?? true;
              const krs = goal.keyResults || [];

              return (
                <div
                  key={goal.id}
                  className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4 shadow-md group"
                >
                  <div className="space-y-3">
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase tracking-wider">
                          {goal.category}
                        </span>
                        {goal.timePeriod && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/60 text-zinc-400 border border-zinc-850">
                            {goal.timePeriod}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            isAchieved
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : isAtRisk
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {goal.status.replace('_', ' ')}
                        </span>

                        <button
                          onClick={() => {
                            setSelectedGoal(goal);
                            setShowAddKrModal(true);
                          }}
                          className="p-1 rounded hover:bg-zinc-900 text-zinc-400 hover:text-emerald-400 transition-colors"
                          title="Add Key Result to this objective"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete objective"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-semibold text-zinc-100 font-mono tracking-tight leading-snug">
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                          {goal.description}
                        </p>
                      )}
                    </div>

                    {/* Overall Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-400">Objective Progress</span>
                        <span className={`font-bold ${isAchieved ? 'text-emerald-400' : 'text-zinc-200'}`}>
                          {progress}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isAchieved
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : isAtRisk
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                              : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Key Results Accordion */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-1.5 border-b border-zinc-900">
                        <button
                          onClick={() => toggleExpandGoal(goal.id)}
                          className="flex items-center gap-1 font-semibold hover:text-zinc-200 transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <span>Key Results ({krs.length})</span>
                        </button>
                        <span className="text-[10px] text-zinc-500">Measurable Outcomes</span>
                      </div>

                      {isExpanded && (
                        <div className="space-y-2 pt-2">
                          {krs.length === 0 ? (
                            <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-850 text-center text-xs font-mono text-zinc-500">
                              No key results defined yet.{' '}
                              <button
                                onClick={() => {
                                  setSelectedGoal(goal);
                                  setShowAddKrModal(true);
                                }}
                                className="text-emerald-400 hover:underline"
                              >
                                + Add key result
                              </button>
                            </div>
                          ) : (
                            krs.map((kr) => {
                              const krPct = kr.progressPercentage !== undefined
                                ? kr.progressPercentage
                                : computeKrProgress(kr.type, kr.startValue, kr.targetValue, kr.currentValue);
                              const krDone = krPct >= 100;

                              return (
                                <div
                                  key={kr.id}
                                  className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between text-xs font-mono">
                                    <div className="flex items-center gap-1.5 truncate pr-2">
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                          kr.type === 'INCREASE'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                            : kr.type === 'DECREASE'
                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                        }`}
                                      >
                                        {kr.type}
                                      </span>
                                      <span className="text-zinc-200 truncate">{kr.title}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`text-[11px] font-bold ${krDone ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                        {krPct}%
                                      </span>
                                      <button
                                        onClick={() => {
                                          setSelectedKr(kr);
                                          setCheckInNewValue(kr.currentValue);
                                          setShowCheckInModal(true);
                                        }}
                                        className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-mono border border-zinc-700 transition-colors"
                                      >
                                        Check In
                                      </button>
                                      <button
                                        onClick={() => handleDeleteKeyResult(kr.id)}
                                        className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                                        title="Delete key result"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                                    <span>
                                      {kr.startValue} → <strong className="text-zinc-300">{kr.currentValue}</strong> / {kr.targetValue} {kr.unit}
                                    </span>
                                    {kr.updates && kr.updates.length > 0 && (
                                      <span className="truncate max-w-xs text-zinc-400">
                                        Last: {kr.updates[0].note || `Updated to ${kr.updates[0].newValue}`}
                                      </span>
                                    )}
                                  </div>

                                  <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        krDone ? 'bg-emerald-500' : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${krPct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-3 border-t border-zinc-900">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-zinc-500" />
                      <span>{goal.owner?.displayName || goal.creator?.displayName || 'Unassigned'}</span>
                    </div>

                    {goal.targetDate && (
                      <div className="flex items-center gap-1 text-[10px]">
                        <Calendar className="h-3 w-3 text-zinc-500" />
                        <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Create Objective Modal ─── */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-zinc-100 font-mono">Create New Strategic Objective</h4>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateObjective} className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Objective Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Elevate Core Platform Reliability to 99.99%"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Description / Strategy</label>
                  <textarea
                    rows={2}
                    placeholder="Context, high-level impact, and strategic intent..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-mono resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none font-mono"
                    >
                      <option value="Strategic">Strategic</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Product">Product</option>
                      <option value="Security">Security</option>
                      <option value="Design">Design</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Time Period</label>
                    <input
                      type="text"
                      placeholder="e.g. Q4 2026, 2026 Annual"
                      value={newTimePeriod}
                      onChange={(e) => setNewTimePeriod(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Target Completion Date</label>
                  <input
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none font-mono"
                  />
                </div>

                {/* Key Results Builder */}
                <div className="pt-2 border-t border-zinc-850 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-300">
                    <span className="font-semibold">Initial Key Results</span>
                    <button
                      type="button"
                      onClick={() =>
                        setInitialKrs((prev) => [
                          ...prev,
                          { title: '', type: 'INCREASE', startValue: 0, targetValue: 100, unit: '%' },
                        ])
                      }
                      className="text-emerald-400 hover:underline text-[11px]"
                    >
                      + Add Key Result
                    </button>
                  </div>

                  {initialKrs.map((kr, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                      <input
                        type="text"
                        placeholder={`Key Result ${idx + 1} (e.g. Reduce P99 API latency)...`}
                        value={kr.title}
                        onChange={(e) => {
                          const updated = [...initialKrs];
                          updated[idx].title = e.target.value;
                          setInitialKrs(updated);
                        }}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none"
                      />

                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-zinc-500 font-mono block">Type</label>
                          <select
                            value={kr.type}
                            onChange={(e: any) => {
                              const updated = [...initialKrs];
                              updated[idx].type = e.target.value;
                              setInitialKrs(updated);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-300 font-mono focus:outline-none"
                          >
                            <option value="INCREASE">INCREASE</option>
                            <option value="DECREASE">DECREASE</option>
                            <option value="BINARY">BINARY</option>
                            <option value="MILESTONE">MILESTONE</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 font-mono block">Start</label>
                          <input
                            type="number"
                            value={kr.startValue}
                            onChange={(e) => {
                              const updated = [...initialKrs];
                              updated[idx].startValue = parseFloat(e.target.value) || 0;
                              setInitialKrs(updated);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 font-mono block">Target</label>
                          <input
                            type="number"
                            value={kr.targetValue}
                            onChange={(e) => {
                              const updated = [...initialKrs];
                              updated[idx].targetValue = parseFloat(e.target.value) || 0;
                              setInitialKrs(updated);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 font-mono block">Unit</label>
                          <input
                            type="text"
                            value={kr.unit}
                            onChange={(e) => {
                              const updated = [...initialKrs];
                              updated[idx].unit = e.target.value;
                              setInitialKrs(updated);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-200 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold transition-all shadow-md shadow-emerald-950/50 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Persisting...' : 'Create Objective'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Add Key Result Modal ─── */}
        {showAddKrModal && selectedGoal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-zinc-100 font-mono">Add Measurable Key Result</h4>
                </div>
                <button
                  onClick={() => setShowAddKrModal(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddKeyResult} className="space-y-3">
                <p className="text-xs font-mono text-zinc-400">
                  Objective: <strong className="text-zinc-200">{selectedGoal.title}</strong>
                </p>

                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Key Result Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Decrease API Error Rate from 2.5% to 0.1%"
                    value={krTitle}
                    onChange={(e) => setKrTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Measurement Type</label>
                  <select
                    value={krType}
                    onChange={(e: any) => setKrType(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none font-mono"
                  >
                    <option value="INCREASE">INCREASE (e.g. Coverage 60% → 90%)</option>
                    <option value="DECREASE">DECREASE (e.g. Latency 250ms → 50ms)</option>
                    <option value="BINARY">BINARY (0 or 100% Completed)</option>
                    <option value="MILESTONE">MILESTONE (Discrete stages completed)</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Start Value</label>
                    <input
                      type="number"
                      value={krStartValue}
                      onChange={(e) => setKrStartValue(parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Target Value</label>
                    <input
                      type="number"
                      value={krTargetValue}
                      onChange={(e) => setKrTargetValue(parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Unit</label>
                    <input
                      type="text"
                      value={krUnit}
                      onChange={(e) => setKrUnit(e.target.value)}
                      placeholder="%, ms, pts"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => setShowAddKrModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold"
                  >
                    Add Key Result
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Key Result Check-In Modal ─── */}
        {showCheckInModal && selectedKr && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-zinc-100 font-mono">Progress Check-In</h4>
                </div>
                <button
                  onClick={() => setShowCheckInModal(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleKeyResultCheckIn} className="space-y-3">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Key Result</span>
                  <p className="text-xs font-mono font-semibold text-zinc-100 mt-0.5">{selectedKr.title}</p>
                  <p className="text-[11px] font-mono text-zinc-400 mt-1">
                    Type: <strong className="text-emerald-400">{selectedKr.type}</strong> · Range: {selectedKr.startValue} → {selectedKr.targetValue} {selectedKr.unit}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <label className="text-xs font-mono text-zinc-300 block">
                    New Measured Value ({selectedKr.unit}):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={checkInNewValue}
                    onChange={(e) => setCheckInNewValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-700"
                  />

                  {/* Real-time calculated preview */}
                  <div className="flex items-center justify-between text-xs font-mono pt-1 text-zinc-400">
                    <span>Computed Progress:</span>
                    <span className="font-bold text-emerald-400">
                      {computeKrProgress(selectedKr.type, selectedKr.startValue, selectedKr.targetValue, checkInNewValue)}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-zinc-400 block mb-1">Check-in Note / Evidence</label>
                  <textarea
                    rows={2}
                    placeholder="Describe accomplishments, blockers, or milestone details..."
                    value={checkInNote}
                    onChange={(e) => setCheckInNote(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => setShowCheckInModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold"
                  >
                    Save & Reconcile
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
