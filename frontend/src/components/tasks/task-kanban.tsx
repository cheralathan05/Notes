'use client';

import React, { useState } from 'react';
import { api, TaskItem, TaskStatusType, TaskPriorityType, ProjectItem } from '@/lib/api';
import {
  Plus,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Folder,
  CheckSquare,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';

interface TaskKanbanProps {
  tasks: TaskItem[];
  projects: ProjectItem[];
  onSelectTask: (taskId: string) => void;
  onRefresh: () => void;
  onOpenCreateWithStatus?: (status: TaskStatusType) => void;
}

const COLUMNS: { id: TaskStatusType; label: string; wipLimit?: number }[] = [
  { id: 'BACKLOG', label: 'Backlog' },
  { id: 'TODO', label: 'To Do' },
  { id: 'IN_PROGRESS', label: 'In Progress', wipLimit: 6 },
  { id: 'IN_REVIEW', label: 'In Review', wipLimit: 4 },
  { id: 'DONE', label: 'Done' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export function TaskKanban({
  tasks,
  projects,
  onSelectTask,
  onRefresh,
  onOpenCreateWithStatus,
}: TaskKanbanProps) {
  const [quickTitleByCol, setQuickTitleByCol] = useState<Record<string, string>>({});
  const [addingCol, setAddingCol] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const getPriorityBadge = (priority: TaskPriorityType) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-900/60">
            URGENT
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-900/60">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
            MED
          </span>
        );
      case 'LOW':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] text-neutral-400 bg-neutral-900 border border-neutral-800">
            LOW
          </span>
        );
      case 'NONE':
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] text-neutral-500 bg-neutral-900 border border-neutral-800">
            NONE
          </span>
        );
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatusType) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    setActionError(null);
    try {
      const res = await api.updateTask(taskId, { status: targetStatus });
      if (!res.success) {
        setActionError(res.error?.message || 'Failed to update task status');
      } else {
        onRefresh();
      }
    } catch (err: any) {
      console.error('Drag and drop status update failed:', err);
      setActionError(err.message || 'Failed to persist status transition');
    }
  };

  const handleQuickCreate = async (e: React.FormEvent, status: TaskStatusType) => {
    e.preventDefault();
    const title = quickTitleByCol[status]?.trim();
    if (!title) return;

    try {
      const res = await api.createTask({
        title,
        status,
        priority: 'MEDIUM',
      });
      if (res.success) {
        setQuickTitleByCol((prev) => ({ ...prev, [status]: '' }));
        setAddingCol(null);
        onRefresh();
      } else {
        setActionError(res.error?.message || 'Failed to create task');
      }
    } catch (err: any) {
      console.error('Quick task creation failed:', err);
      setActionError(err.message || 'Failed to create task');
    }
  };

  const isOverdue = (dueDateStr?: string | null) => {
    if (!dueDateStr) return false;
    return new Date(dueDateStr) < new Date() && new Date().toDateString() !== new Date(dueDateStr).toDateString();
  };

  return (
    <div className="flex-1 overflow-x-auto p-6 bg-[#080808] flex flex-col">
      {/* Error Alert Toast */}
      {actionError && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center justify-between shrink-0 shadow-lg animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Columns Container */}
      <div className="flex gap-4 min-w-[1400px] h-[calc(100vh-230px)] items-start">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isOverWip = col.wipLimit && colTasks.length > col.wipLimit;
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex-1 min-w-[260px] max-w-[320px] bg-[#101010] border rounded-xl flex flex-col max-h-full shadow-lg transition-colors ${
                isOver ? 'border-neutral-400 bg-[#141414]' : 'border-[#222222]'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-[#202020] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-semibold text-neutral-200 tracking-wider uppercase">
                    {col.label}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                      isOverWip
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                        : 'bg-[#1c1c1c] text-neutral-400 border border-[#2c2c2c]'
                    }`}
                  >
                    {colTasks.length}
                    {col.wipLimit ? `/${col.wipLimit}` : ''}
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (onOpenCreateWithStatus) {
                      onOpenCreateWithStatus(col.id);
                    } else {
                      setAddingCol(addingCol === col.id ? null : col.id);
                    }
                  }}
                  title={`Add task in ${col.label}`}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#1f1f1f] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Inline Quick Add Form */}
              {addingCol === col.id && (
                <form
                  onSubmit={(e) => handleQuickCreate(e, col.id)}
                  className="p-3 border-b border-[#202020] bg-[#141414] space-y-2"
                >
                  <input
                    type="text"
                    autoFocus
                    value={quickTitleByCol[col.id] || ''}
                    onChange={(e) =>
                      setQuickTitleByCol({ ...quickTitleByCol, [col.id]: e.target.value })
                    }
                    placeholder="Task title..."
                    className="w-full bg-[#1c1c1c] border border-[#2e2e2e] text-xs text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-neutral-400 placeholder:text-neutral-500"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAddingCol(null)}
                      className="px-2 py-1 text-[11px] text-neutral-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!quickTitleByCol[col.id]?.trim()}
                      className="px-2.5 py-1 text-[11px] font-medium bg-neutral-200 text-black hover:bg-white rounded transition-colors disabled:opacity-40"
                    >
                      Create
                    </button>
                  </div>
                </form>
              )}

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTask(t.id)}
                    className="p-3 rounded-lg bg-[#151515] hover:bg-[#1a1a1a] border border-[#242424] hover:border-[#383838] transition-all cursor-pointer shadow-sm group space-y-2"
                  >
                    {/* Top Row: Task ID & Priority */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-neutral-500 group-hover:text-neutral-400">
                        TASK-{t.id.slice(0, 6)}
                      </span>
                      {getPriorityBadge(t.priority)}
                    </div>

                    {/* Title */}
                    <p className="text-xs font-medium text-neutral-100 leading-snug line-clamp-2">
                      {t.title}
                    </p>

                    {/* Labels */}
                    {t.labels && t.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {t.labels.map((l: any, idx: number) => {
                          const labelObj = l.label || l;
                          return (
                            <span
                              key={labelObj.id || idx}
                              className="px-1.5 py-0.5 rounded text-[9px] font-medium border"
                              style={{
                                borderColor: (labelObj.color || '#737373') + '60',
                                backgroundColor: (labelObj.color || '#737373') + '20',
                                color: labelObj.color || '#a3a3a3',
                              }}
                            >
                              {labelObj.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Blocker alert tag if blocked */}
                    {t.isBlocked && (
                      <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-900/40 text-[10px] font-medium">
                        <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">Blocked by {t.blockers?.[0]?.title}</span>
                      </div>
                    )}

                    {/* Bottom Meta Row */}
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1.5 border-t border-[#1e1e1e]">
                      {/* Assignee / Project */}
                      <div className="flex items-center space-x-2 truncate max-w-[140px]">
                        {t.assignee ? (
                          <span className="flex items-center gap-1 text-[10px] text-neutral-300 bg-[#1c1c1c] border border-[#2e2e2e] px-1.5 py-0.5 rounded-full truncate" title={`Assigned to ${t.assignee.displayName}`}>
                            <span className="w-3.5 h-3.5 rounded-full bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-white uppercase shrink-0">
                              {t.assignee.displayName.charAt(0)}
                            </span>
                            <span className="truncate max-w-[70px]">{t.assignee.displayName}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-600 italic">Unassigned</span>
                        )}

                        {t.project && (
                          <span className="flex items-center gap-1 text-[10px] text-neutral-400 truncate max-w-[80px]" title={t.project.name}>
                            <Folder className="w-3 h-3 text-neutral-500 shrink-0" />
                            <span className="truncate">{t.project.name}</span>
                          </span>
                        )}
                      </div>

                      {/* Right metadata: subtasks and due date */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {t.subtaskProgress && t.subtaskProgress.total > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-neutral-400" title={`${t.subtaskProgress.done}/${t.subtaskProgress.total} subtasks completed`}>
                            <CheckSquare className="w-3 h-3 text-neutral-500" />
                            {t.subtaskProgress.done}/{t.subtaskProgress.total}
                          </span>
                        )}

                        {t.dueDate && (
                          <span
                            className={`flex items-center gap-1 text-[10px] ${
                              isOverdue(t.dueDate) && t.status !== 'DONE'
                                ? 'text-rose-400 font-semibold'
                                : 'text-neutral-400'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            {new Date(t.dueDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="py-8 text-center text-xs text-neutral-600">
                    No tasks in {col.label.toLowerCase()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
