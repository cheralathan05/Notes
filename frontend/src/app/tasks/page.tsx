'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '@/components/app-shell';
import {
  api,
  API_BASE_URL,
  TaskItem,
  ProjectItem,
  TaskPriorityType,
  TaskStatusType,
} from '@/lib/api';
import { TaskKanban } from '@/components/tasks/task-kanban';
import { TaskList } from '@/components/tasks/task-list';
import { TaskCalendar } from '@/components/tasks/task-calendar';
import { TaskTimeline } from '@/components/tasks/task-timeline';
import { MyDayView } from '@/components/tasks/my-day-view';
import { ProjectManager } from '@/components/tasks/project-manager';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { TerminalCommandCenter } from '@/components/tasks/terminal-command-center';
import {
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
  GanttChart,
  Sun,
  Folder,
  Plus,
  Terminal,
  RefreshCw,
  X,
  Radio,
  Search,
  Filter,
  Bug,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
} from 'lucide-react';

export default function TasksWorkspacePage() {
  const [view, setView] = useState<'board' | 'list' | 'calendar' | 'timeline' | 'my-day' | 'projects'>('board');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<Array<{ id: string; userId: string; user: { id: string; displayName: string; email: string; avatarUrl?: string | null } }>>([]);
  const [loading, setLoading] = useState(true);

  // Global filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('ALL');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);

  // Selected task for detail panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Terminal state
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Quick Create Task Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatusType>('TODO');
  const [newPriority, setNewPriority] = useState<TaskPriorityType>('MEDIUM');
  const [newAssigneeId, setNewAssigneeId] = useState<string>('none');
  const [newDueDate, setNewDueDate] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEstimatedHours, setNewEstimatedHours] = useState('');
  const [newProjectId, setNewProjectId] = useState<string>('none');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Create Issue Modal state (Phase 11)
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueType, setIssueType] = useState('Bug');
  const [issueSeverity, setIssueSeverity] = useState('HIGH');
  const [issueReproSteps, setIssueReproSteps] = useState('');
  const [issueExpected, setIssueExpected] = useState('');
  const [issueActual, setIssueActual] = useState('');
  const [issueEnv, setIssueEnv] = useState('');
  const [issueProjectId, setIssueProjectId] = useState<string>('none');
  const [issueAssigneeId, setIssueAssigneeId] = useState<string>('none');
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);

  // Real-time connection status
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, projectsRes, membersRes] = await Promise.all([
        api.getTasks({
          projectId: selectedProjectId || undefined,
          parentOnly: true,
        }),
        api.getProjects(),
        api.listWorkspaceMembers().catch(() => ({ success: false, data: { members: [] } })),
      ]);

      if (tasksRes.success && tasksRes.data?.tasks) {
        setTasks(tasksRes.data.tasks);
      }
      if (projectsRes.success && projectsRes.data?.projects) {
        setProjects(projectsRes.data.projects);
      }
      if (membersRes.success && membersRes.data?.members) {
        setWorkspaceMembers(membersRes.data.members);
      }
    } catch (err) {
      console.error('Failed to load tasks workspace data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

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

  // Real-Time SSE Stream Integration
  useEffect(() => {
    const apiBase = API_BASE_URL;
    const eventSource = new EventSource(`${apiBase}/api/tasks/events`, {
      withCredentials: true,
    });

    eventSource.onopen = () => {
      setIsLiveConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          [
            'TASK_CREATED',
            'TASK_UPDATED',
            'TASK_DELETED',
            'TASKS_BULK_UPDATED',
            'PROJECT_PROGRESS_UPDATED',
            'PROJECT_CREATED',
            'PROJECT_UPDATED',
          ].includes(payload.type)
        ) {
          loadData();
        }
      } catch {
        // Ignore unparseable frames
      }
    };

    eventSource.onerror = () => {
      setIsLiveConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [loadData]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Terminal: Ctrl+` or Ctrl+\
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.key === '\\')) {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
      // Quick Create Task: 'c' when not inside input
      if (
        e.key.toLowerCase() === 'c' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) &&
        !isCreateModalOpen &&
        !isIssueModalOpen &&
        !isTerminalOpen
      ) {
        e.preventDefault();
        setIsCreateModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, isIssueModalOpen, isTerminalOpen]);

  // Real-time Metrics Calculation
  const metrics = useMemo(() => {
    const now = new Date();
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === 'TODO' || t.status === 'BACKLOG').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
    const done = tasks.filter((t) => t.status === 'DONE').length;
    const overdue = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    ).length;

    return { total, todo, inProgress, done, overdue };
  }, [tasks]);

  // Filtered tasks shared across Board, List, Calendar, Timeline
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
      if (selectedPriority !== 'ALL' && t.priority !== selectedPriority) return false;
      if (selectedAssigneeId !== 'ALL') {
        if (selectedAssigneeId === 'UNASSIGNED') {
          if (t.assigneeId) return false;
        } else if (t.assigneeId !== selectedAssigneeId) {
          return false;
        }
      }
      if (isOverdueOnly) {
        if (!t.dueDate || new Date(t.dueDate) >= new Date() || t.status === 'DONE') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [tasks, selectedStatus, selectedPriority, selectedAssigneeId, isOverdueOnly, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedProjectId !== null ||
    selectedStatus !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedAssigneeId !== 'ALL' ||
    isOverdueOnly;

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedProjectId(null);
    setSelectedStatus('ALL');
    setSelectedPriority('ALL');
    setSelectedAssigneeId('ALL');
    setIsOverdueOnly(false);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreatingTask(true);
    try {
      const res = await api.createTask({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        status: newStatus,
        priority: newPriority,
        dueDate: newDueDate || undefined,
        startDate: newStartDate || undefined,
        estimatedHours: newEstimatedHours ? parseFloat(newEstimatedHours) : undefined,
        projectId: newProjectId === 'none' ? undefined : newProjectId,
        assigneeId: newAssigneeId === 'none' ? undefined : newAssigneeId,
      });

      if (res.success) {
        setIsCreateModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setNewStatus('TODO');
        setNewPriority('MEDIUM');
        setNewAssigneeId('none');
        setNewDueDate('');
        setNewStartDate('');
        setNewEstimatedHours('');
        setNewProjectId('none');
        loadData();
      } else {
        alert(res.error?.message || 'Failed to create task');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim()) return;
    setIsCreatingIssue(true);
    try {
      const criteria = [
        { id: 'type', text: `Issue Type: ${issueType}`, isCompleted: false },
        { id: 'repro', text: `Reproduction: ${issueReproSteps || 'N/A'}`, isCompleted: false },
        { id: 'expected', text: `Expected: ${issueExpected || 'N/A'}`, isCompleted: false },
        { id: 'actual', text: `Actual: ${issueActual || 'N/A'}`, isCompleted: false },
        { id: 'env', text: `Environment: ${issueEnv || 'N/A'}`, isCompleted: false },
      ];

      const res = await api.createTask({
        title: `[${issueType.toUpperCase()}] ${issueTitle.trim()}`,
        description: `### Reproduction Steps\n${issueReproSteps || 'None provided'}\n\n### Expected\n${issueExpected || 'None'}\n\n### Actual\n${issueActual || 'None'}\n\n### Environment\n${issueEnv || 'None'}`,
        status: 'TODO',
        priority: issueSeverity as TaskPriorityType,
        projectId: issueProjectId === 'none' ? undefined : issueProjectId,
        assigneeId: issueAssigneeId === 'none' ? undefined : issueAssigneeId,
        acceptanceCriteria: criteria,
      });

      if (res.success && res.data?.task) {
        // Tag with bug label automatically
        try {
          await api.addTaskLabel(res.data.task.id, { name: 'bug', color: '#e11d48' });
        } catch {}

        setIsIssueModalOpen(false);
        setIssueTitle('');
        setIssueReproSteps('');
        setIssueExpected('');
        setIssueActual('');
        setIssueEnv('');
        setIssueProjectId('none');
        setIssueAssigneeId('none');
        loadData();
      } else {
        alert(res.error?.message || 'Failed to file issue');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to file issue');
    } finally {
      setIsCreatingIssue(false);
    }
  };

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppShell>
      <div className="flex-1 flex flex-col h-full bg-[#080808] text-neutral-200 overflow-hidden select-none">
        {/* Top Contextual Header */}
        <header className="px-6 py-3.5 bg-[#0D0D0D] border-b border-[#222222] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: Title, Description, Real-time metrics */}
          <div className="flex items-center space-x-6">
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-sm font-bold text-white tracking-tight uppercase">
                  Tasks & Issues
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#181818] text-neutral-400 border border-[#2a2a2a]">
                  KRONOS OS
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 hidden sm:block">
                Sprints, issue tracking, and cross-team execution
              </p>
            </div>

            {/* Metrics Chips */}
            <div className="hidden lg:flex items-center space-x-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-[#141414] border border-[#242424] text-neutral-300">
                Total: <strong className="text-white">{metrics.total}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#141414] border border-[#242424] text-neutral-400">
                Todo: <strong className="text-white">{metrics.todo}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#141414] border border-[#242424] text-neutral-400">
                Active: <strong className="text-white">{metrics.inProgress}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#141414] border border-[#242424] text-emerald-400">
                Done: <strong className="text-emerald-300">{metrics.done}</strong>
              </span>
              {metrics.overdue > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-900/60 text-rose-300 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {metrics.overdue} Overdue
                </span>
              )}
            </div>
          </div>

          {/* Right: Live Sync, Terminal, New Issue, New Task */}
          <div className="flex items-center space-x-2.5">
            {/* Live SSE status indicator */}
            <div
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-[10px] font-mono ${
                isLiveConnected
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40'
                  : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
              }`}
              title={isLiveConnected ? 'Live real-time sync active' : 'Connecting to live events...'}
            >
              <Radio
                className={`w-3 h-3 ${isLiveConnected ? 'text-emerald-400 animate-pulse' : 'text-neutral-500'}`}
              />
              <span className="hidden sm:inline">{isLiveConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
            </div>

            {/* In-App Terminal Toggle Button */}
            <button
              onClick={() => setIsTerminalOpen((prev) => !prev)}
              className="px-3 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#282828] text-neutral-200 hover:text-white text-xs font-mono rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
              title="Open Workspace Command Center (Ctrl+`)"
            >
              <Terminal className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden md:inline">&gt;_ Terminal</span>
            </button>

            {/* Create Issue Action (Phase 11) */}
            <button
              onClick={() => setIsIssueModalOpen(true)}
              className="px-3 py-1.5 bg-[#181818] hover:bg-[#222222] border border-[#2f2f2f] text-neutral-200 hover:text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
              title="Report an issue or bug"
            >
              <Bug className="w-3.5 h-3.5 text-rose-400" />
              <span>Report Issue</span>
            </button>

            {/* Quick Create Task Button */}
            <button
              onClick={() => {
                setNewStatus('TODO');
                setIsCreateModalOpen(true);
              }}
              className="px-3 py-1.5 bg-neutral-200 hover:bg-white text-black text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </header>

        {/* View Switcher & Global Filter Bar */}
        <div className="px-6 py-2.5 bg-[#101010] border-b border-[#202020] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* View Tabs */}
          <div className="flex items-center space-x-1 p-1 bg-[#161616] border border-[#262626] rounded-lg text-xs">
            <button
              onClick={() => setView('board')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                view === 'board'
                  ? 'bg-neutral-200 text-black shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>

            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                view === 'list'
                  ? 'bg-neutral-200 text-black shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>

            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                view === 'calendar'
                  ? 'bg-neutral-200 text-black shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>

            <button
              onClick={() => setView('timeline')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                view === 'timeline'
                  ? 'bg-neutral-200 text-black shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <GanttChart className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>

            <button
              onClick={() => setView('my-day')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                view === 'my-day'
                  ? 'bg-neutral-200 text-black shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>My Day</span>
            </button>

            <button
              onClick={() => setView('projects')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                view === 'projects'
                  ? 'bg-neutral-200 text-black shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-neutral-400" />
              <span>Projects</span>
            </button>
          </div>

          {/* Unified Filter Controls */}
          {view !== 'projects' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Search Box */}
              <div className="relative min-w-[160px] max-w-[220px]">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter tasks..."
                  className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg pl-8 pr-2.5 py-1 focus:outline-none focus:border-neutral-500 placeholder:text-neutral-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Project Filter */}
              <select
                value={selectedProjectId || 'ALL'}
                onChange={(e) => setSelectedProjectId(e.target.value === 'ALL' ? null : e.target.value)}
                className="bg-[#181818] border border-[#2a2a2a] text-xs text-neutral-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-neutral-500"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-[#181818] border border-[#2a2a2a] text-xs text-neutral-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-neutral-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="BACKLOG">Backlog</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              {/* Priority Filter */}
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="bg-[#181818] border border-[#2a2a2a] text-xs text-neutral-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-neutral-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              {/* Assignee Filter */}
              <select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
                className="bg-[#181818] border border-[#2a2a2a] text-xs text-neutral-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-neutral-500"
              >
                <option value="ALL">All Assignees</option>
                <option value="UNASSIGNED">Unassigned</option>
                {workspaceMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.displayName || m.userId}
                  </option>
                ))}
              </select>

              {/* Overdue toggle */}
              <button
                onClick={() => setIsOverdueOnly(!isOverdueOnly)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
                  isOverdueOnly
                    ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                    : 'bg-[#181818] border-[#2a2a2a] text-neutral-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Overdue</span>
              </button>

              {/* Clear filters button */}
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-2 py-1 text-xs text-neutral-400 hover:text-white hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-7 h-7 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
            </div>
          ) : view === 'board' ? (
            <TaskKanban
              tasks={filteredTasks}
              projects={projects}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onRefresh={loadData}
              onOpenCreateWithStatus={(colStatus) => {
                setNewStatus(colStatus);
                setIsCreateModalOpen(true);
              }}
            />
          ) : view === 'list' ? (
            <TaskList
              tasks={filteredTasks}
              projects={projects}
              members={workspaceMembers}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onRefresh={loadData}
            />
          ) : view === 'calendar' ? (
            <TaskCalendar
              tasks={filteredTasks}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onQuickCreateDate={(dateStr) => {
                setNewDueDate(dateStr);
                setIsCreateModalOpen(true);
              }}
            />
          ) : view === 'timeline' ? (
            <TaskTimeline
              tasks={filteredTasks}
              onSelectTask={(id) => setSelectedTaskId(id)}
            />
          ) : view === 'my-day' ? (
            <MyDayView
              onSelectTask={(id) => setSelectedTaskId(id)}
              onRefresh={loadData}
            />
          ) : (
            <ProjectManager
              projects={projects}
              onSelectProject={(id) => {
                setSelectedProjectId(id);
                setView('board');
              }}
              onRefresh={loadData}
            />
          )}

          {/* Task Detail Slide-over Panel */}
          <TaskDetailPanel
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onTaskUpdated={loadData}
            projects={projects}
            members={workspaceMembers}
          />

          {/* In-App Terminal Command Center Drawer */}
          <TerminalCommandCenter
            isOpen={isTerminalOpen}
            onClose={() => setIsTerminalOpen(false)}
            onTaskMutated={loadData}
          />
        </main>

        {/* Quick Create Task Modal Dialog */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#111111] border border-[#262626] rounded-xl p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <h3 className="text-sm font-semibold text-white">Create New Task</h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Implement payment webhook, Design hero banner..."
                    className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={2}
                    placeholder="Acceptance criteria, context, or links..."
                    className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as TaskStatusType)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    >
                      <option value="BACKLOG">Backlog</option>
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="DONE">Done</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Priority
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as TaskPriorityType)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    >
                      <option value="URGENT">Urgent</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                      <option value="NONE">None</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Assignee
                    </label>
                    <select
                      value={newAssigneeId}
                      onChange={(e) => setNewAssigneeId(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    >
                      <option value="none">Unassigned</option>
                      {workspaceMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user?.displayName || m.userId}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Assign to Project
                    </label>
                    <select
                      value={newProjectId}
                      onChange={(e) => setNewProjectId(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    >
                      <option value="none">No Project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Est. Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="e.g. 4"
                      value={newEstimatedHours}
                      onChange={(e) => setNewEstimatedHours(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#222222]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-3 py-1.5 text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingTask || !newTitle.trim()}
                    className="px-4 py-1.5 bg-neutral-200 hover:bg-white text-black font-semibold rounded-lg transition-colors disabled:opacity-40"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Issue Modal Dialog (Phase 11) */}
        {isIssueModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#111111] border border-[#262626] rounded-xl p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <div className="flex items-center space-x-2">
                  <Bug className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-semibold text-white">Report New Issue / Defect</h3>
                </div>
                <button
                  onClick={() => setIsIssueModalOpen(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateIssue} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Issue Title *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    placeholder="e.g. Cannot complete task with unfinished blockers"
                    className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Issue Type
                    </label>
                    <select
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    >
                      <option value="Bug">Bug / Defect</option>
                      <option value="Regression">Regression</option>
                      <option value="Security">Security Vulnerability</option>
                      <option value="Performance">Performance Issue</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Severity / Priority
                    </label>
                    <select
                      value={issueSeverity}
                      onChange={(e) => setIssueSeverity(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    >
                      <option value="URGENT">Critical (Blocker)</option>
                      <option value="HIGH">High (Major)</option>
                      <option value="MEDIUM">Medium (Moderate)</option>
                      <option value="LOW">Low (Minor)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Related Project
                    </label>
                    <select
                      value={issueProjectId}
                      onChange={(e) => setIssueProjectId(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    >
                      <option value="none">No Project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Assignee
                    </label>
                    <select
                      value={issueAssigneeId}
                      onChange={(e) => setIssueAssigneeId(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    >
                      <option value="none">Unassigned</option>
                      {workspaceMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user?.displayName || m.userId}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Reproduction Steps
                  </label>
                  <textarea
                    rows={2}
                    value={issueReproSteps}
                    onChange={(e) => setIssueReproSteps(e.target.value)}
                    placeholder="1. Open board&#10;2. Drag task to Done&#10;3. Observe response..."
                    className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Expected Behavior
                    </label>
                    <textarea
                      rows={2}
                      value={issueExpected}
                      onChange={(e) => setIssueExpected(e.target.value)}
                      placeholder="Expected state or result..."
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Actual Behavior
                    </label>
                    <textarea
                      rows={2}
                      value={issueActual}
                      onChange={(e) => setIssueActual(e.target.value)}
                      placeholder="What actually happens..."
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Environment (OS, Browser, Commit)
                  </label>
                  <input
                    type="text"
                    value={issueEnv}
                    onChange={(e) => setIssueEnv(e.target.value)}
                    placeholder="e.g. Windows 11, Chrome 130, Node 22"
                    className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#222222]">
                  <button
                    type="button"
                    onClick={() => setIsIssueModalOpen(false)}
                    className="px-3 py-1.5 text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingIssue || !issueTitle.trim()}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-40"
                  >
                    File Issue
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
