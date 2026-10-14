'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

export default function TasksWorkspacePage() {
  const [view, setView] = useState<'board' | 'list' | 'calendar' | 'timeline' | 'my-day' | 'projects'>('board');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active contextual filters
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Selected task for detail panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Terminal state
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Quick Create Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriorityType>('MEDIUM');
  const [newDueDate, setNewDueDate] = useState('');
  const [newProjectId, setNewProjectId] = useState<string>('none');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Real-time connection status
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        api.getTasks({
          projectId: selectedProjectId || undefined,
          parentOnly: true,
        }),
        api.getProjects(),
      ]);

      if (tasksRes.success && tasksRes.data?.tasks) {
        setTasks(tasksRes.data.tasks);
      }
      if (projectsRes.success && projectsRes.data?.projects) {
        setProjects(projectsRes.data.projects);
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
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) &&
        !isCreateModalOpen &&
        !isTerminalOpen
      ) {
        e.preventDefault();
        setIsCreateModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, isTerminalOpen]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreatingTask(true);
    try {
      const res = await api.createTask({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        dueDate: newDueDate || undefined,
        projectId: newProjectId === 'none' ? undefined : newProjectId,
      });

      if (res.success) {
        setIsCreateModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setNewPriority('MEDIUM');
        setNewDueDate('');
        setNewProjectId('none');
        loadData();
      }
    } finally {
      setIsCreatingTask(false);
    }
  };

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppShell>
      <div className="flex-1 flex flex-col h-full bg-[#080808] text-neutral-200 overflow-hidden select-none">
        {/* Top Contextual Header */}
        <header className="px-6 py-3.5 bg-[#0D0D0D] border-b border-[#222222] flex items-center justify-between shrink-0">
          {/* Left: View Tabs & Project Filter Indicator */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 p-1 bg-[#141414] border border-[#222222] rounded-lg text-xs">
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

            {/* Active Project Scope Pill */}
            {activeProject && (
              <div className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-[#181818] border border-[#2c2c2c] text-xs">
                <span className="text-neutral-500 text-[11px]">Scope:</span>
                <span className="font-semibold text-white truncate max-w-[150px]">
                  {activeProject.name}
                </span>
                <button
                  onClick={() => setSelectedProjectId(null)}
                  title="Clear project filter"
                  className="text-neutral-500 hover:text-white ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Real-time Live Badge, Terminal Toggle, New Task */}
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
              <span>{isLiveConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
            </div>

            {/* In-App Terminal Toggle Button */}
            <button
              onClick={() => setIsTerminalOpen((prev) => !prev)}
              className="px-3 py-1.5 bg-[#141414] hover:bg-[#1f1f1f] border border-[#282828] text-neutral-200 hover:text-white text-xs font-mono rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
              title="Open Workspace Command Center (Ctrl+`)"
            >
              <Terminal className="w-3.5 h-3.5 text-neutral-400" />
              <span>&gt;_ Terminal</span>
            </button>

            {/* Quick Create Task Button */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 bg-neutral-200 hover:bg-white text-black text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-7 h-7 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
            </div>
          ) : view === 'board' ? (
            <TaskKanban
              tasks={tasks}
              projects={projects}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onRefresh={loadData}
            />
          ) : view === 'list' ? (
            <TaskList
              tasks={tasks}
              projects={projects}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onRefresh={loadData}
            />
          ) : view === 'calendar' ? (
            <TaskCalendar
              tasks={tasks}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onQuickCreateDate={(dateStr) => {
                setNewDueDate(dateStr);
                setIsCreateModalOpen(true);
              }}
            />
          ) : view === 'timeline' ? (
            <TaskTimeline
              tasks={tasks}
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
            <div className="w-full max-w-md bg-[#111111] border border-[#262626] rounded-xl p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
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

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
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
      </div>
    </AppShell>
  );
}
