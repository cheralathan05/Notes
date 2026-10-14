'use client';

import React, { useState, useEffect } from 'react';
import {
  api,
  TaskItem,
  TaskStatusType,
  TaskPriorityType,
  ProjectItem,
  TaskEvidenceItem,
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
  ShieldCheck,
  Terminal,
  Code2,
  Lock,
  Unlock,
  Check,
} from 'lucide-react';

import { TaskCompletionWizardModal } from './task-completion-wizard-modal';

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
  const [activeTab, setActiveTab] = useState<'details' | 'criteria' | 'evidence' | 'subtasks' | 'comments'>('details');

  // Atlas Developer Workspace states
  const [evidenceList, setEvidenceList] = useState<TaskEvidenceItem[]>([]);
  const [newCritText, setNewCritText] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

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
    loadEvidence();
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

  const loadEvidence = async () => {
    if (!taskId) return;
    try {
      const res = await api.getTaskEvidence(taskId);
      if (res.success && res.data?.evidence) {
        setEvidenceList(res.data.evidence);
      }
    } catch {
      // Non-blocking
    }
  };

  const handleClaim = async () => {
    if (!task) return;
    setIsClaiming(true);
    try {
      const res = await api.claimTask(task.id, 180);
      if (res.success && res.data?.task) {
        setTask(res.data.task);
        onTaskUpdated();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to claim task');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRelease = async () => {
    if (!task) return;
    setIsClaiming(true);
    try {
      const res = await api.releaseTask(task.id);
      if (res.success && res.data?.task) {
        setTask(res.data.task);
        onTaskUpdated();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to release task claim');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleToggleCriterion = async (critId: string, currentStatus: boolean) => {
    if (!task) return;
    const currentList = (task.acceptanceCriteria || []) as Array<{ id: string; text: string; isCompleted: boolean }>;
    const updated = currentList.map((c) => (c.id === critId ? { ...c, isCompleted: !currentStatus } : c));
    setTask((prev) => (prev ? { ...prev, acceptanceCriteria: updated } : null));

    try {
      const res = await api.updateTaskCriteria(task.id, updated);
      if (res.success && res.data?.task) {
        setTask(res.data.task);
        onTaskUpdated();
      }
    } catch {
      loadTask();
    }
  };

  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newCritText.trim()) return;

    const currentList = (task.acceptanceCriteria || []) as Array<{ id: string; text: string; isCompleted: boolean }>;
    const newCrit = {
      id: `crit_${Date.now().toString(36)}`,
      text: newCritText.trim(),
      isCompleted: false,
    };
    const updated = [...currentList, newCrit];
    setNewCritText('');
    setTask((prev) => (prev ? { ...prev, acceptanceCriteria: updated } : null));

    try {
      const res = await api.updateTaskCriteria(task.id, updated);
      if (res.success && res.data?.task) {
        setTask(res.data.task);
        onTaskUpdated();
      }
    } catch {
      loadTask();
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

          {/* Atlas Developer Workspace Status & Claim Lease */}
          <div className="p-3.5 rounded-lg bg-[#141414] border border-[#262626] space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-white text-[11px] uppercase tracking-wider">Atlas Developer Workspace</span>
              </div>
              {task.isVerified && (
                <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 text-[10px] font-mono font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  VERIFIED DONE
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#222222]">
              <div className="flex items-center space-x-1.5 text-neutral-400">
                {task.claimedById ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Claimed by <strong className="text-white">{task.claimedBy?.displayName || task.claimedBy?.email || 'Developer'}</strong></span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-neutral-500">Unclaimed (No active lease)</span>
                  </>
                )}
              </div>

              <div>
                {task.claimedById ? (
                  <button
                    onClick={handleRelease}
                    disabled={isClaiming}
                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] rounded font-medium transition-colors"
                  >
                    Release Lease
                  </button>
                ) : (
                  <button
                    onClick={handleClaim}
                    disabled={isClaiming}
                    className="px-2.5 py-1 bg-neutral-200 hover:bg-white text-black text-[11px] rounded font-semibold transition-colors"
                  >
                    Claim Task (Lease)
                  </button>
                )}
              </div>
            </div>

            {task.branchName && (
              <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-neutral-500" />
                <span>Branch: <span className="text-white">{task.branchName}</span></span>
              </div>
            )}

            {/* Launch Completion Wizard Trigger */}
            <div className="pt-2 border-t border-[#222222] flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">Completion Engine:</span>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-black text-[11px] font-semibold rounded flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-black" />
                <span>Launch Completion Wizard</span>
              </button>
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
          <div className="flex border-b border-[#222222] text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'details'
                  ? 'border-white text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              Checklist ({task.checklistProgress?.done || 0}/{task.checklistProgress?.total || 0})
            </button>
            <button
              onClick={() => setActiveTab('criteria')}
              className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'criteria'
                  ? 'border-white text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Criteria ({((task.acceptanceCriteria as any[]) || []).filter((c: any) => c.isCompleted).length}/{((task.acceptanceCriteria as any[]) || []).length})
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'evidence'
                  ? 'border-white text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Evidence ({evidenceList.length})
            </button>
            <button
              onClick={() => setActiveTab('subtasks')}
              className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
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
              className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
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

          {/* TAB: Acceptance Criteria */}
          {activeTab === 'criteria' && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                  Acceptance criteria define the mandatory conditions for this task. The Atlas CLI and VS Code extension check these before marking the task <span className="font-mono text-emerald-400">DONE</span>.
                </p>

                <div className="space-y-2">
                  {((task.acceptanceCriteria as any[]) || []).map((crit: any) => (
                    <div
                      key={crit.id}
                      onClick={() => handleToggleCriterion(crit.id, crit.isCompleted)}
                      className={`flex items-start space-x-2.5 p-2.5 rounded border cursor-pointer transition-colors ${
                        crit.isCompleted
                          ? 'bg-emerald-950/20 border-emerald-900/40'
                          : 'bg-[#141414] border-[#222222] hover:bg-[#1a1a1a]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={crit.isCompleted}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-[#333333] bg-[#1a1a1a] text-emerald-500 focus:ring-0"
                      />
                      <div className="flex-1">
                        <span
                          className={`text-xs ${
                            crit.isCompleted ? 'line-through text-neutral-400 font-normal' : 'text-neutral-100 font-medium'
                          }`}
                        >
                          {crit.text}
                        </span>
                      </div>
                      {crit.isCompleted && (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 font-semibold">
                          Satisfied
                        </span>
                      )}
                    </div>
                  ))}

                  {(!task.acceptanceCriteria || (task.acceptanceCriteria as any[]).length === 0) && (
                    <div className="p-4 rounded border border-dashed border-[#2b2b2b] text-center text-xs text-neutral-500">
                      No acceptance criteria defined yet. Add the requirements developers must satisfy.
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddCriterion} className="mt-3 flex gap-1.5">
                  <input
                    type="text"
                    value={newCritText}
                    onChange={(e) => setNewCritText(e.target.value)}
                    placeholder="e.g. Pass all unit tests and update auth docs..."
                    className="flex-1 bg-[#141414] border border-[#242424] text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
                  />
                  <button
                    type="submit"
                    disabled={!newCritText.trim()}
                    className="p-1.5 px-3 bg-neutral-200 hover:bg-white text-black text-xs rounded font-semibold disabled:opacity-40 transition-colors"
                  >
                    Add Criterion
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: Execution Evidence */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                  Evidence submitted by developers via the Atlas CLI (<span className="font-mono text-cyan-300">atlas task submit</span>) or VS Code extension. Results are verified server-side.
                </p>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
                  {evidenceList.map((ev) => (
                    <div key={ev.id} className="p-3 rounded-lg bg-[#141414] border border-[#242424] text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              ev.status === 'PASSED'
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                            }`}
                          >
                            {ev.status}
                          </span>
                          <span className="font-mono text-white text-[11px]">{ev.command}</span>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          exit code: {ev.exitCode}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400 font-mono bg-[#111111] p-2 rounded border border-[#1e1e1e]">
                        {ev.commitHash && (
                          <div>
                            Commit: <span className="text-white">{ev.commitHash.slice(0, 7)}</span>
                          </div>
                        )}
                        {ev.branch && (
                          <div>
                            Branch: <span className="text-white">{ev.branch}</span>
                          </div>
                        )}
                        {ev.changedFiles && (
                          <div className="col-span-2">
                            Files changed: <span className="text-white">{ev.changedFiles.length} file(s)</span>
                          </div>
                        )}
                      </div>

                      {ev.stdoutSnippet && (
                        <div className="mt-1">
                          <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Standard Output</span>
                          <pre className="text-[10px] font-mono p-2 rounded bg-black border border-[#222222] text-neutral-300 overflow-x-auto whitespace-pre-wrap max-h-24">
                            {ev.stdoutSnippet}
                          </pre>
                        </div>
                      )}

                      {ev.stderrSnippet && (
                        <div className="mt-1">
                          <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1">Error Output</span>
                          <pre className="text-[10px] font-mono p-2 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300 overflow-x-auto whitespace-pre-wrap max-h-24">
                            {ev.stderrSnippet}
                          </pre>
                        </div>
                      )}

                      <div className="text-[10px] text-neutral-500 text-right">
                        Submitted {new Date(ev.createdAt || ev.executedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}

                  {evidenceList.length === 0 && (
                    <div className="p-4 rounded border border-dashed border-[#2b2b2b] text-center space-y-2">
                      <Terminal className="w-5 h-5 text-neutral-500 mx-auto" />
                      <p className="text-xs text-neutral-400 font-medium">No verified evidence submitted yet.</p>
                      <p className="text-[11px] text-neutral-500">
                        Run tests and submit evidence from your terminal using:
                      </p>
                      <pre className="text-[10px] font-mono p-2 rounded bg-black border border-[#222222] text-cyan-300 text-left inline-block">
                        atlas checks run TASK-{task.id.slice(0, 8)}<br/>
                        atlas task submit TASK-{task.id.slice(0, 8)}
                      </pre>
                    </div>
                  )}
                </div>
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

      {isWizardOpen && task && (
        <TaskCompletionWizardModal
          task={task}
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onCompleted={() => {
            loadTask();
            loadEvidence();
            onTaskUpdated();
          }}
        />
      )}
    </div>
  );
}

