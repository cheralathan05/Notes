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
} from 'lucide-react';

interface TaskKanbanProps {
  tasks: TaskItem[];
  projects: ProjectItem[];
  onSelectTask: (taskId: string) => void;
  onRefresh: () => void;
}

const COLUMNS: { id: TaskStatusType; label: string; wipLimit?: number }[] = [
  { id: 'TODO', label: 'To Do' },
  { id: 'IN_PROGRESS', label: 'In Progress', wipLimit: 6 },
  { id: 'IN_REVIEW', label: 'In Review', wipLimit: 4 },
  { id: 'DONE', label: 'Done' },
];

export function TaskKanban({
  tasks,
  projects,
  onSelectTask,
  onRefresh,
}: TaskKanbanProps) {
  const [quickTitleByCol, setQuickTitleByCol] = useState<Record<string, string>>({});
  const [addingCol, setAddingCol] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

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
      default:
        return null;
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatusType) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    try {
      await api.updateTask(taskId, { status: targetStatus });
      onRefresh();
    } catch (err) {
      console.error('Drag and drop status update failed:', err);
    }
  };

  const handleQuickCreate = async (e: React.FormEvent, status: TaskStatusType) => {
    e.preventDefault();
    const title = quickTitleByCol[status]?.trim();
    if (!title) return;

    try {
      await api.createTask({
        title,
        status,
        priority: 'MEDIUM',
      });
      setQuickTitleByCol((prev) => ({ ...prev, [status]: '' }));
      setAddingCol(null);
      onRefresh();
    } catch (err) {
      console.error('Quick task creation failed:', err);
    }
  };

  const isOverdue = (dueDateStr?: string | null) => {
    if (!dueDateStr) return false;
    return new Date(dueDateStr) < new Date() && new Date().toDateString() !== new Date(dueDateStr).toDateString();
  };

  return (
    <div className="flex-1 overflow-x-auto p-6 bg-[#080808]">
      <div className="flex gap-4 min-w-[1040px] h-[calc(100vh-210px)] items-start">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isOverWip = col.wipLimit && colTasks.length > col.wipLimit;

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className="flex-1 min-w-[280px] max-w-[340px] bg-[#101010] border border-[#222222] rounded-xl flex flex-col max-h-full shadow-lg"
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
                  onClick={() => setAddingCol(addingCol === col.id ? null : col.id)}
                  title="Quick add task"
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
                    className="p-3 rounded-lg bg-[#151515] hover:bg-[#1a1a1a] border border-[#242424] hover:border-[#383838] transition-all cursor-pointer shadow-sm group space-y-2.5"
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

                    {/* Blocker alert tag if blocked */}
                    {t.isBlocked && (
                      <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-900/40 text-[10px] font-medium">
                        <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">Blocked by {t.blockers?.[0]?.title}</span>
                      </div>
                    )}

                    {/* Bottom Meta Row */}
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-[#1e1e1e]">
                      {t.project ? (
                        <span className="flex items-center gap-1 text-neutral-400 truncate max-w-[120px]">
                          <Folder className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span className="truncate">{t.project.name}</span>
                        </span>
                      ) : (
                        <span />
                      )}

                      <div className="flex items-center space-x-2 shrink-0">
                        {t.subtaskProgress && t.subtaskProgress.total > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-neutral-400">
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
