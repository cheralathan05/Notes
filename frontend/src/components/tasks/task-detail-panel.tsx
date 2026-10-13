'use client';

import React, { useState, useEffect } from 'react';
import {
  api,
  TaskItem,
  TaskStatusType,
  TaskPriorityType,
  ProjectItem,
} from '@/lib/api';
import {
  X,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Folder,
  FileText,
  User,
  Plus,
  Send,
  Trash2,
  ShieldAlert,
  ArrowRight,
  GitBranch,
  ListTodo,
  MessageSquare,
  History,
} from 'lucide-react';

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated: () => void;
  projects?: ProjectItem[];
}

export function TaskDetailPanel({
  taskId,
  onClose,
  onTaskUpdated,
  projects = [],
}: TaskDetailPanelProps) {
  const [task, setTask] = useState<TaskItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'comments'>('details');

  // Input states
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dependencyInput, setDependencyInput] = useState('');
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await api.getTask(taskId);
      if (res.success && res.data?.task) {
        setTask(res.data.task);
      }
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: TaskStatusType) => {
    if (!task) return;
    try {
      const res = await api.updateTask(task.id, { status });
      if (res.success && res.data?.task) {
        setTask((prev) => (prev ? { ...prev, status } : null));
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handlePriorityChange = async (priority: TaskPriorityType) => {
    if (!task) return;
    try {
      const res = await api.updateTask(task.id, { priority });
      if (res.success && res.data?.task) {
        setTask((prev) => (prev ? { ...prev, priority } : null));
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleProjectChange = async (projectId: string) => {
    if (!task) return;
    try {
      const pId = projectId === 'none' ? null : projectId;
      const res = await api.updateTask(task.id, { projectId: pId });
      if (res.success) {
        await loadTask();
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Failed to update project:', err);
    }
  };

  const handleDueDateChange = async (dateStr: string) => {
    if (!task) return;
    try {
      const res = await api.updateTask(task.id, { dueDate: dateStr || null });
      if (res.success) {
        setTask((prev) => (prev ? { ...prev, dueDate: dateStr || null } : null));
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Failed to update due date:', err);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.createTask({
        title: newSubtaskTitle.trim(),
        parentId: task.id,
        projectId: task.projectId || undefined,
      });
      if (res.success) {
        setNewSubtaskTitle('');
        await loadTask();
        onTaskUpdated();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newChecklistTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.addChecklistItem(task.id, newChecklistTitle.trim());
      if (res.success) {
        setNewChecklistTitle('');
        await loadTask();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleChecklist = async (itemId: string, current: boolean) => {
    if (!task) return;
    try {
      const res = await api.toggleChecklistItem(task.id, itemId, !current);
      if (res.success) {
        await loadTask();
      }
    } catch (err) {
      console.error('Failed to toggle checklist:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newCommentText.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.addTaskComment(task.id, newCommentText.trim());
      if (res.success) {
        setNewCommentText('');
        await loadTask();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !dependencyInput.trim()) return;
    setDependencyError(null);
    try {
      const res = await api.addDependency(task.id, dependencyInput.trim());
      if (res.success) {
        setDependencyInput('');
        await loadTask();
        onTaskUpdated();
      } else {
        setDependencyError(res.error?.message || 'Failed to add dependency');
      }
    } catch (err: any) {
      setDependencyError(err.message || 'Error occurred');
    }
  };

  const handleRemoveDependency = async (blockingId: string) => {
    if (!task) return;
    try {
      await api.removeDependency(task.id, blockingId);
      await loadTask();
      onTaskUpdated();
    } catch (err) {
      console.error('Failed to remove dependency:', err);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!confirm(`Are you sure you want to delete task "${task.title}"?`)) return;
    try {
      await api.deleteTask(task.id);
      onTaskUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  if (!taskId) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[520px] max-w-full bg-[#0D0D0D] border-l border-[#262626] shadow-2xl flex flex-col text-neutral-200">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-[#121212]">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1C1C1C] text-neutral-400 border border-[#2A2A2A]">
            TASK-{taskId.slice(0, 8)}
          </span>
          {task?.project && (
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-neutral-500" />
              {task.project.name}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleDeleteTask}
            title="Delete Task"
            className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-[#202020] rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-[#202020] rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && !task ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
        </div>
      ) : task ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Blocker Alert Banner */}
          {task.isBlocked && (
            <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-rose-200">Task is currently blocked</p>
                <p className="text-[11px] text-rose-400 mt-0.5">
                  Cannot proceed until blocking predecessor tasks are marked DONE:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {task.blockers?.map((b) => (
                    <li key={b.id} className="font-mono text-[11px] flex items-center gap-1.5 text-rose-200">
                      <span>•</span>
                      <span>[{b.status}]</span>
                      <span className="font-sans font-medium text-white">{b.title}</span>
                      {b.assignee && <span className="text-rose-400">({b.assignee.displayName})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">{task.title}</h2>
            {task.description && (
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">{task.description}</p>
            )}
          </div>

          {/* Quick Properties Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-[#141414] border border-[#222222] text-xs">
            {/* Status */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block mb-1">
                Status
              </label>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatusType)}
                className="w-full bg-[#1e1e1e] border border-[#2e2e2e] text-neutral-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
              >
                <option value="BACKLOG">Backlog</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block mb-1">
                Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => handlePriorityChange(e.target.value as TaskPriorityType)}
                className="w-full bg-[#1e1e1e] border border-[#2e2e2e] text-neutral-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
              >
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="NONE">None</option>
              </select>
            </div>

            {/* Project */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block mb-1">
                Project
              </label>
              <select
                value={task.projectId || 'none'}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#2e2e2e] text-neutral-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
              >
                <option value="none">No Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 block mb-1">
                Deadline
              </label>
              <input
                type="date"
                value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#2e2e2e] text-neutral-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>

          {/* Linked Documents (Documents & Notes Integration) */}
          {task.document && (
            <div className="p-3 rounded-lg bg-[#141414] border border-[#222222] flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-400">Linked Document:</span>
                <span className="font-medium text-white">{task.document.title}</span>
              </div>
              <a
                href={`/documents?docId=${task.document.id}`}
                className="text-[11px] text-neutral-400 hover:text-white underline"
              >
                Open Document
              </a>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex border-b border-[#222222] text-xs">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'border-white text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              Checklist ({task.checklistProgress?.done || 0}/{task.checklistProgress?.total || 0})
            </button>
            <button
              onClick={() => setActiveTab('subtasks')}
              className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'subtasks'
                  ? 'border-white text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Subtasks ({task.subtasks?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'comments'
                  ? 'border-white text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Discussion ({task.comments?.length || 0})
            </button>
          </div>

          {/* TAB 1: Checklist & Dependencies */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* Checklist Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-neutral-300">Checklist Items</span>
                  {task.checklistProgress && task.checklistProgress.total > 0 && (
                    <span className="text-[11px] text-neutral-500">
                      {task.checklistProgress.percentage}% complete
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {(task.checklists || []).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklist(item.id, item.isCompleted)}
                      className="flex items-center space-x-2.5 p-2 rounded hover:bg-[#181818] cursor-pointer group text-xs transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.isCompleted}
                        onChange={() => {}} // handled by click
                        className="rounded border-[#333333] bg-[#1a1a1a] text-neutral-100 focus:ring-0"
                      />
                      <span
                        className={`flex-1 ${
                          item.isCompleted ? 'line-through text-neutral-500' : 'text-neutral-200'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddChecklistItem} className="mt-2.5 flex gap-1.5">
                  <input
                    type="text"
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="Add checklist item..."
                    className="flex-1 bg-[#141414] border border-[#242424] text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !newChecklistTitle.trim()}
                    className="p-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded font-medium disabled:opacity-40 transition-colors"
                  >
                    Add
                  </button>
                </form>
              </div>

              {/* Dependencies Section */}
              <div className="pt-4 border-t border-[#222222]">
                <span className="text-xs font-semibold text-neutral-300 block mb-2">
                  Dependencies & Blockers (Finish-to-Start)
                </span>

                {task.blockers && task.blockers.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {task.blockers.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-2 rounded bg-[#171717] border border-[#262626] text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-neutral-300 font-medium">{b.title}</span>
                          <span className="text-[10px] text-neutral-500">[{b.status}]</span>
                        </div>
                        <button
                          onClick={() => handleRemoveDependency(b.id)}
                          className="text-[10px] text-neutral-500 hover:text-rose-400"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddDependency} className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={dependencyInput}
                      onChange={(e) => setDependencyInput(e.target.value)}
                      placeholder="Predecessor Task ID or Title (e.g. TASK-102)..."
                      className="flex-1 bg-[#141414] border border-[#242424] text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !dependencyInput.trim()}
                      className="p-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded font-medium disabled:opacity-40 transition-colors"
                    >
                      Link Blocker
                    </button>
                  </div>
                  {dependencyError && (
                    <p className="text-[11px] text-rose-400 font-medium">{dependencyError}</p>
                  )}
                  <p className="text-[10px] text-neutral-600">
                    Enforces strict DAG validation. Circular deadlocks are automatically rejected.
                  </p>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: Subtasks */}
          {activeTab === 'subtasks' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                {(task.subtasks || []).map((sub: any) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-2.5 rounded bg-[#141414] border border-[#222222] text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          sub.status === 'DONE' ? 'bg-emerald-500' : 'bg-neutral-500'
                        }`}
                      />
                      <span className={sub.status === 'DONE' ? 'line-through text-neutral-500' : 'text-white'}>
                        {sub.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 uppercase">{sub.status}</span>
                  </div>
                ))}
                {(!task.subtasks || task.subtasks.length === 0) && (
                  <p className="text-xs text-neutral-600 py-3 text-center">No subtasks yet.</p>
                )}
              </div>

              <form onSubmit={handleAddSubtask} className="flex gap-1.5">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="New subtask title..."
                  className="flex-1 bg-[#141414] border border-[#242424] text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newSubtaskTitle.trim()}
                  className="p-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded font-medium disabled:opacity-40 transition-colors"
                >
                  Create
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: Comments */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                {(task.comments || []).map((c) => (
                  <div key={c.id} className="p-3 rounded bg-[#141414] border border-[#222222] text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="font-semibold text-neutral-200">
                        {c.user?.displayName || c.user?.email || 'Workspace Member'}
                      </span>
                      <span className="text-neutral-600">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
                {(!task.comments || task.comments.length === 0) && (
                  <p className="text-xs text-neutral-600 py-4 text-center">No comments on this task.</p>
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-1.5">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Leave a comment or update..."
                  className="flex-1 bg-[#141414] border border-[#242424] text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newCommentText.trim()}
                  className="p-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded font-medium disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-neutral-500">
          Task not found.
        </div>
      )}
    </div>
  );
}
