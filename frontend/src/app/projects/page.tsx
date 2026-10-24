'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import {
  api,
  ProjectItem,
  ProjectStatusType,
  ProjectHealthType,
  WorkspacePublic,
  TaskItem,
} from '@/lib/api';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import {
  Folder,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Archive,
  RotateCcw,
  Trash2,
  ChevronRight,
  X,
  Clock,
  User,
  Users,
  CheckSquare,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Flag,
} from 'lucide-react';

export default function ProjectsDashboardPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectStatusType | 'ARCHIVED'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'targetDate' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Workspaces context
  const [workspaces, setWorkspaces] = useState<WorkspacePublic[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspacePublic | null>(null);

  // Create Project Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#FAFAFA');
  const [newIcon, setNewIcon] = useState('📁');
  const [newStartDate, setNewStartDate] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected Project for Detail Drawer
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Project Settings editing
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatusType>('ACTIVE');

  // Milestone creation inside drawer
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');

  // Selected task to open in slide-over panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const storedWsId = api.getActiveWorkspaceId();
      const [projRes, wsRes] = await Promise.all([
        api.getProjects({
          search: searchQuery.trim() || undefined,
          status: statusFilter !== 'ALL' && statusFilter !== 'ARCHIVED' ? statusFilter : undefined,
          includeArchived: statusFilter === 'ARCHIVED',
          sortBy,
          sortOrder,
          workspaceId: storedWsId || undefined,
        }),
        api.listWorkspaces().catch(() => ({ success: false, data: { workspaces: [] } })),
      ]);

      if (projRes.success && projRes.data?.projects) {
        setProjects(projRes.data.projects);
      } else {
        setErrorMessage(projRes.error?.message || 'Failed to fetch projects');
      }

      if (wsRes.success && wsRes.data?.workspaces) {
        setWorkspaces(wsRes.data.workspaces);
        const active = (storedWsId ? wsRes.data.workspaces.find((w: any) => w.id === storedWsId) : null) ||
          wsRes.data.workspaces.find((w: any) => w.isCurrent) ||
          wsRes.data.workspaces[0];
        setCurrentWorkspace(active || null);
        if (active && !storedWsId) {
          api.setActiveWorkspaceId(active.id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load projects:', err);
      setErrorMessage(err.message || 'Error communicating with workspace API');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleWsChange = () => {
      loadData();
    };
    window.addEventListener('kronos:workspace-changed', handleWsChange);
    return () => window.removeEventListener('kronos:workspace-changed', handleWsChange);
  }, [loadData]);

  const loadProjectDetails = async (id: string) => {
    setSelectedProjectId(id);
    setDetailLoading(true);
    try {
      const res = await api.getProject(id);
      if (res.success && res.data?.project) {
        setSelectedProject(res.data.project);
        setEditName(res.data.project.name);
        setEditDesc(res.data.project.description || '');
        setEditStatus(res.data.project.status);
        setEditTargetDate(
          res.data.project.targetDate
            ? new Date(res.data.project.targetDate).toISOString().split('T')[0]
            : ''
        );
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.createProject({
        name: newTitle.trim(),
        description: newDesc.trim() || undefined,
        color: newColor,
        icon: newIcon,
        startDate: newStartDate || undefined,
        targetDate: newTargetDate || undefined,
      });

      if (res.success) {
        setIsCreateOpen(false);
        setNewTitle('');
        setNewDesc('');
        setNewStartDate('');
        setNewTargetDate('');
        await loadData();
      } else {
        alert(res.error?.message || 'Failed to create project');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !editName.trim()) return;
    try {
      const res = await api.updateProject(selectedProjectId, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        status: editStatus,
        targetDate: editTargetDate ? new Date(editTargetDate).toISOString() : null,
      });
      if (res.success) {
        setIsEditingSettings(false);
        await loadProjectDetails(selectedProjectId);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to update project settings:', err);
    }
  };

  const handleArchiveToggle = async (projectId: string, isCurrentlyArchived: boolean) => {
    const action = isCurrentlyArchived ? 'unarchive' : 'archive';
    if (!confirm(`Are you sure you want to ${action} this project?`)) return;

    try {
      if (isCurrentlyArchived) {
        await api.unarchiveProject(projectId);
      } else {
        await api.archiveProject(projectId);
      }
      if (selectedProjectId === projectId) {
        await loadProjectDetails(projectId);
      }
      await loadData();
    } catch (err) {
      console.error(`Failed to ${action} project:`, err);
    }
  };

  const handleDeleteProject = async (projectId: string, name: string) => {
    if (!confirm(`Permanently delete project "${name}"? This action cannot be undone.`)) return;
    try {
      await api.deleteProject(projectId);
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
        setSelectedProject(null);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleRecalculateProgress = async (projectId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.recalculateProjectProgress(projectId);
      if (selectedProjectId === projectId) {
        await loadProjectDetails(projectId);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to recalculate project progress:', err);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newMilestoneTitle.trim()) return;
    try {
      const res = await api.addMilestone(selectedProjectId, {
        title: newMilestoneTitle.trim(),
        targetDate: newMilestoneDate || undefined,
      });
      if (res.success) {
        setNewMilestoneTitle('');
        setNewMilestoneDate('');
        await loadProjectDetails(selectedProjectId);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to add milestone:', err);
    }
  };

  const handleToggleMilestone = async (milestoneId: string, isCompleted: boolean) => {
    if (!selectedProjectId) return;
    try {
      await api.updateMilestone(selectedProjectId, milestoneId, {
        isCompleted: !isCompleted,
      });
      await loadProjectDetails(selectedProjectId);
      await loadData();
    } catch (err) {
      console.error('Failed to toggle milestone:', err);
    }
  };

  const getHealthBadge = (health: ProjectHealthType) => {
    switch (health) {
      case 'ON_TRACK':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-900/60 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ON TRACK
          </span>
        );
      case 'AT_RISK':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-900/60 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> AT RISK
          </span>
        );
      case 'OFF_TRACK':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-900/60 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" /> OFF TRACK
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: ProjectStatusType, isArchived?: boolean) => {
    if (isArchived) {
      return (
        <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-500 text-[10px] font-semibold">
          ARCHIVED
        </span>
      );
    }
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950/60 text-blue-300 border border-blue-900/60">
            ACTIVE
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-900/60">
            COMPLETED
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-900/60">
            ON HOLD
          </span>
        );
      case 'PLANNING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            PLANNING
          </span>
        );
      default:
        return null;
    }
  };

  // Metrics summary
  const totalProjectsCount = projects.length;
  const activeCount = projects.filter((p) => p.status === 'ACTIVE' && !p.isArchived).length;
  const completedCount = projects.filter((p) => p.status === 'COMPLETED').length;
  const avgProgress = totalProjectsCount > 0
    ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / totalProjectsCount)
    : 0;

  return (
    <AppShell>
      <div className="flex-1 flex flex-col h-full bg-[#080808] text-neutral-200 overflow-hidden select-none">
        
        {/* Top Header */}
        <header className="px-6 py-4 bg-[#0D0D0D] border-b border-[#222222] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-white" />
              <h1 className="text-lg font-bold text-white tracking-tight">Projects Dashboard</h1>
              {currentWorkspace && (
                <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 text-[10px] font-mono">
                  {currentWorkspace.name}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Initiatives, deliverables, and automated completion percentage calculation.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => loadData()}
              title="Refresh project metrics"
              className="px-3 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#282828] text-neutral-300 hover:text-white text-xs font-mono rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/tasks"
              className="px-3 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#282828] text-neutral-300 hover:text-white text-xs font-mono rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <CheckSquare className="w-3.5 h-3.5 text-neutral-400" />
              <span>All Tasks</span>
            </Link>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-3 py-1.5 bg-neutral-200 hover:bg-white text-black text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>
        </header>

        {/* Workspace Telemetry Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-[#0A0A0A] border-b border-[#1E1E1E]">
          <div className="bg-[#121212] border border-[#242424] rounded-lg p-3">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">Total Projects</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{totalProjectsCount}</div>
          </div>
          <div className="bg-[#121212] border border-[#242424] rounded-lg p-3">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">Active Initiatives</span>
            <div className="text-lg font-bold text-blue-400 font-mono mt-0.5">{activeCount}</div>
          </div>
          <div className="bg-[#121212] border border-[#242424] rounded-lg p-3">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">Completed</span>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{completedCount}</div>
          </div>
          <div className="bg-[#121212] border border-[#242424] rounded-lg p-3">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">Avg Progress</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{avgProgress}%</div>
          </div>
        </div>

        {/* Filter & Controls Toolbar */}
        <div className="px-6 py-3 bg-[#0D0D0D] border-b border-[#202020] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects by title or description..."
              className="w-full bg-[#141414] border border-[#282828] text-xs text-white pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-neutral-400"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['ALL', 'ACTIVE', 'PLANNING', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-neutral-200 text-black font-semibold'
                    : 'bg-[#141414] text-neutral-400 hover:text-white border border-[#242424]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sorting */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 text-[11px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#141414] border border-[#282828] text-xs text-neutral-300 rounded px-2.5 py-1 focus:outline-none focus:border-neutral-400"
            >
              <option value="createdAt">Created Date</option>
              <option value="name">Project Name</option>
              <option value="progress">Progress %</option>
              <option value="targetDate">Target Date</option>
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title="Toggle sort direction"
              className="p-1 rounded bg-[#141414] border border-[#282828] text-neutral-400 hover:text-white"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Projects Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-2">
              <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
              <span className="text-xs text-neutral-500 font-mono">Loading projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-20 bg-[#0E0E0E] border border-dashed border-[#242424] rounded-xl space-y-3">
              <Folder className="w-8 h-8 text-neutral-600 mx-auto" />
              <h3 className="text-sm font-semibold text-neutral-300">No Projects Found</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No projects match your active search and filter criteria.'
                  : 'Get started by creating your first project initiative for this workspace.'}
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-2 px-3.5 py-1.5 bg-neutral-200 hover:bg-white text-black text-xs font-semibold rounded-lg inline-flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((p) => {
                const totalTasks = p._count?.tasks ?? (p.tasks?.length || 0);
                const completedTasks = (p.tasks || []).filter((t: any) => t.status === 'DONE').length;

                return (
                  <div
                    key={p.id}
                    onClick={() => loadProjectDetails(p.id)}
                    className="p-5 rounded-xl bg-[#111216] hover:bg-[#15171c] border border-[#242730] hover:border-[#383d4a] transition-all cursor-pointer shadow-md space-y-4 group flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#181920] border border-[#2b2d38] flex items-center justify-center text-sm">
                            {p.icon || '📁'}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white group-hover:text-neutral-100 transition-colors line-clamp-1">
                              {p.name}
                            </h3>
                            <span className="text-[10px] font-mono text-neutral-500">
                              PROJ-{p.id.slice(0, 6).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {getHealthBadge(p.health)}
                          {getStatusBadge(p.status, p.isArchived)}
                        </div>
                      </div>

                      {/* Description */}
                      {p.description && (
                        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      )}

                      {/* Progress Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-500 font-medium">Progress</span>
                          <span className="text-white font-mono font-semibold">{p.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#1f2026] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-neutral-200 transition-all duration-300 rounded-full"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Metadata & Milestones */}
                    <div className="pt-3 border-t border-[#1e2029] space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                        <span className="flex items-center gap-1">
                          <CheckSquare className="w-3 h-3 text-neutral-500" />
                          {completedTasks}/{totalTasks} tasks done
                        </span>
                        {p.targetDate && (
                          <span className="flex items-center gap-1 text-neutral-400">
                            <Calendar className="w-3 h-3 text-neutral-500" />
                            {new Date(p.targetDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>

                      {p.milestones && p.milestones.length > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                          <Flag className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span className="truncate">
                            Next: {p.milestones[0].title}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Project Detail Drawer ─── */}
        {selectedProjectId && (
          <div className="fixed inset-y-0 right-0 z-40 w-[580px] max-w-full bg-[#0D0D11] border-l border-[#272730] shadow-2xl flex flex-col text-neutral-200 animate-in slide-in-from-right duration-200">
            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
              </div>
            ) : selectedProject ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-[#22222a] bg-[#121218] flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-[#1a1b24] flex items-center justify-center text-sm">
                        {selectedProject.icon || '📁'}
                      </div>
                      <h2 className="text-base font-bold text-white tracking-tight">{selectedProject.name}</h2>
                      {getHealthBadge(selectedProject.health)}
                    </div>
                    <span className="text-[11px] font-mono text-neutral-500 block">
                      PROJ-{selectedProject.id.slice(0, 8).toUpperCase()} • Created by {selectedProject.creator?.displayName || 'Lead'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRecalculateProgress(selectedProject.id)}
                      title="Recalculate progress"
                      className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-[#1f2029] transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProjectId(null);
                        setSelectedProject(null);
                      }}
                      className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-[#1f2029] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Progress & Formula Breakdown Card */}
                  <div className="p-4 rounded-xl bg-[#14151c] border border-[#262833] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-mono font-bold tracking-wider text-neutral-400">
                        Initiative Progress
                      </span>
                      <span className="text-base font-mono font-bold text-white">
                        {selectedProject.progress}%
                      </span>
                    </div>

                    <div className="w-full h-2 bg-[#20222c] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neutral-100 rounded-full transition-all duration-300"
                        style={{ width: `${selectedProject.progress}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-neutral-500 font-mono leading-relaxed">
                      Calculated as: <span className="text-neutral-300 font-bold">(done root tasks / total active root tasks) × 100%</span>. Subtasks roll up into parent progress.
                    </p>
                  </div>

                  {/* Settings / Edit Section Toggle */}
                  <div className="p-4 rounded-xl bg-[#14151c] border border-[#262833] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300 uppercase font-mono">
                        Project Settings
                      </span>
                      <button
                        onClick={() => setIsEditingSettings(!isEditingSettings)}
                        className="text-xs text-neutral-400 hover:text-white underline"
                      >
                        {isEditingSettings ? 'Cancel' : 'Edit Settings'}
                      </button>
                    </div>

                    {isEditingSettings ? (
                      <form onSubmit={handleUpdateProjectSettings} className="space-y-3 text-xs">
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-1">Project Name</label>
                          <input
                            type="text"
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-[#0d0e12] border border-[#2b2d3a] p-2 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-1">Description</label>
                          <textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={2}
                            className="w-full bg-[#0d0e12] border border-[#2b2d3a] p-2 rounded text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-neutral-400 block mb-1">Status</label>
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as any)}
                              className="w-full bg-[#0d0e12] border border-[#2b2d3a] p-2 rounded text-white"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="PLANNING">PLANNING</option>
                              <option value="ON_HOLD">ON_HOLD</option>
                              <option value="COMPLETED">COMPLETED</option>
                              <option value="ARCHIVED">ARCHIVED</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-neutral-400 block mb-1">Target Date</label>
                            <input
                              type="date"
                              value={editTargetDate}
                              onChange={(e) => setEditTargetDate(e.target.value)}
                              className="w-full bg-[#0d0e12] border border-[#2b2d3a] p-2 rounded text-white"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-white text-black font-semibold rounded text-xs"
                          >
                            Save Changes
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-2 text-xs">
                        {selectedProject.description && (
                          <p className="text-neutral-400 leading-relaxed">{selectedProject.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-[11px] text-neutral-400 font-mono pt-1">
                          <span>Status: <strong className="text-white">{selectedProject.status}</strong></span>
                          {selectedProject.targetDate && (
                            <span>Target: <strong className="text-white">{new Date(selectedProject.targetDate).toLocaleDateString()}</strong></span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Milestones Management */}
                  <div className="p-4 rounded-xl bg-[#14151c] border border-[#262833] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300 uppercase font-mono flex items-center gap-1.5">
                        <Flag className="w-3.5 h-3.5 text-neutral-400" />
                        Milestones ({selectedProject.milestones?.length || 0})
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {(selectedProject.milestones || []).map((m) => (
                        <div
                          key={m.id}
                          onClick={() => handleToggleMilestone(m.id, m.isCompleted)}
                          className="flex items-center justify-between p-2 rounded bg-[#0f1015] hover:bg-[#161720] border border-[#22242f] cursor-pointer text-xs transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                m.isCompleted ? 'text-emerald-400' : 'text-neutral-600'
                              }`}
                            />
                            <span
                              className={`text-xs ${
                                m.isCompleted ? 'line-through text-neutral-500' : 'text-white'
                              }`}
                            >
                              {m.title}
                            </span>
                          </div>
                          {m.dueDate && (
                            <span className="text-[10px] text-neutral-500 font-mono">
                              {new Date(m.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add Milestone Form */}
                    <form onSubmit={handleAddMilestone} className="flex gap-2 pt-1 text-xs">
                      <input
                        type="text"
                        value={newMilestoneTitle}
                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                        placeholder="New milestone title..."
                        className="flex-1 bg-[#0d0e12] border border-[#2b2d3a] p-1.5 rounded text-white text-xs"
                      />
                      <input
                        type="date"
                        value={newMilestoneDate}
                        onChange={(e) => setNewMilestoneDate(e.target.value)}
                        className="bg-[#0d0e12] border border-[#2b2d3a] p-1.5 rounded text-white text-xs"
                      />
                      <button
                        type="submit"
                        disabled={!newMilestoneTitle.trim()}
                        className="px-3 py-1.5 bg-neutral-200 hover:bg-white text-black font-semibold rounded text-xs disabled:opacity-40"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Scoped Related Tasks */}
                  <div className="p-4 rounded-xl bg-[#14151c] border border-[#262833] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300 uppercase font-mono flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-neutral-400" />
                        Related Tasks ({selectedProject.tasks?.length || 0})
                      </span>

                      <Link
                        href={`/tasks?projectId=${selectedProject.id}`}
                        className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                      >
                        <span>Open in Board</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {(selectedProject.tasks || []).map((t: any) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTaskId(t.id)}
                          className="flex items-center justify-between p-2 rounded bg-[#0f1015] hover:bg-[#161720] border border-[#22242f] cursor-pointer text-xs transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                t.status === 'DONE' ? 'bg-emerald-500' : 'bg-neutral-600'
                              }`}
                            />
                            <span className={t.status === 'DONE' ? 'line-through text-neutral-500' : 'text-white'}>
                              {t.title}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 text-[10px] font-mono">
                            {t.status}
                          </span>
                        </div>
                      ))}

                      {(!selectedProject.tasks || selectedProject.tasks.length === 0) && (
                        <p className="text-xs text-neutral-500 text-center py-4">No tasks assigned to this project yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Danger / Action Zone */}
                  <div className="pt-3 border-t border-[#22222a] flex items-center justify-between">
                    <button
                      onClick={() => handleArchiveToggle(selectedProject.id, !!selectedProject.isArchived)}
                      className="px-3 py-1.5 rounded bg-[#181920] border border-[#2d2f3d] text-neutral-300 hover:text-white text-xs flex items-center gap-1.5"
                    >
                      {selectedProject.isArchived ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Unarchive Project</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive Project</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteProject(selectedProject.id, selectedProject.name)}
                      className="px-3 py-1.5 rounded bg-rose-950/20 border border-rose-900/40 text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ─── Create Project Modal ─── */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#111216] border border-[#272730] rounded-xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-[#22222a] pb-3">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold text-white">Create New Project</h3>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Core Engine Synchronization, Mobile App v2..."
                    className="w-full bg-[#181920] border border-[#2b2d38] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    placeholder="Key deliverables and project goals..."
                    className="w-full bg-[#181920] border border-[#2b2d38] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className="w-full bg-[#181920] border border-[#2b2d38] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Target Completion Date
                    </label>
                    <input
                      type="date"
                      value={newTargetDate}
                      onChange={(e) => setNewTargetDate(e.target.value)}
                      className="w-full bg-[#181920] border border-[#2b2d38] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#202028]">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newTitle.trim()}
                    className="px-4 py-1.5 bg-white text-black font-semibold rounded-lg text-xs hover:bg-neutral-200 transition-colors disabled:opacity-40"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Task Detail Slide-over Panel */}
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={loadData}
          projects={projects}
        />
      </div>
    </AppShell>
  );
}
