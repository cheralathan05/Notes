'use client';

import React, { useState, useMemo } from 'react';
import { api, TaskItem, TaskStatusType, TaskPriorityType, ProjectItem } from '@/lib/api';
import {
  CheckCircle2,
  Calendar,
  Folder,
  ShieldAlert,
  Search,
  Filter,
  CheckSquare,
  Square,
  Trash2,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  Tag,
} from 'lucide-react';

interface TaskListProps {
  tasks: TaskItem[];
  projects: ProjectItem[];
  members?: Array<{ id: string; userId: string; user: { id: string; displayName: string; email: string; avatarUrl?: string | null } }>;
  onSelectTask: (taskId: string) => void;
  onRefresh: () => void;
}

type SortField = 'id' | 'title' | 'status' | 'priority' | 'assignee' | 'project' | 'dueDate' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export function TaskList({
  tasks,
  projects,
  members = [],
  onSelectTask,
  onRefresh,
}: TaskListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [bulkAssigneeId, setBulkAssigneeId] = useState<string>('');

  const priorityOrder: Record<TaskPriorityType, number> = {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    NONE: 0,
  };

  const statusOrder: Record<TaskStatusType, number> = {
    BACKLOG: 0,
    TODO: 1,
    IN_PROGRESS: 2,
    IN_REVIEW: 3,
    DONE: 4,
    CANCELLED: 5,
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'id':
          comparison = a.id.localeCompare(b.id);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          break;
        case 'priority':
          comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
          break;
        case 'assignee':
          comparison = (a.assignee?.displayName || '').localeCompare(b.assignee?.displayName || '');
          break;
        case 'project':
          comparison = (a.project?.name || '').localeCompare(b.project?.name || '');
          break;
        case 'dueDate': {
          const timeA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const timeB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case 'updatedAt':
        default: {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [tasks, sortField, sortOrder]);

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedTasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedTasks.map((t) => t.id));
    }
  };

  const toggleSelectOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkComplete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkOperating(true);
    try {
      await api.bulkTasks(selectedIds, 'complete');
      setSelectedIds([]);
      onRefresh();
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkPriority = async (priority: TaskPriorityType) => {
    if (selectedIds.length === 0) return;
    setIsBulkOperating(true);
    try {
      await api.bulkTasks(selectedIds, 'priority', { priority });
      setSelectedIds([]);
      onRefresh();
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkAssign = async (userId: string) => {
    if (selectedIds.length === 0 || !userId) return;
    setIsBulkOperating(true);
    try {
      await api.bulkTasks(selectedIds, 'assign', { assigneeId: userId === 'none' ? null : userId });
      setSelectedIds([]);
      setBulkAssigneeId('');
      onRefresh();
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.length} tasks?`)) return;
    setIsBulkOperating(true);
    try {
      await api.bulkTasks(selectedIds, 'delete');
      setSelectedIds([]);
      onRefresh();
    } finally {
      setIsBulkOperating(false);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-neutral-600 ml-1 inline" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-white ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 text-white ml-1 inline" />
    );
  };

  const isOverdue = (dueDateStr?: string | null) => {
    if (!dueDateStr) return false;
    return new Date(dueDateStr) < new Date() && new Date().toDateString() !== new Date(dueDateStr).toDateString();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#080808] text-neutral-200 space-y-4">
      {/* Sticky Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="p-3 px-4 bg-[#141414] border border-[#2e2e2e] rounded-xl flex flex-wrap items-center justify-between text-xs shadow-xl animate-in fade-in duration-150 gap-3">
          <span className="font-semibold text-white">
            {selectedIds.length} task(s) selected
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBulkComplete}
              disabled={isBulkOperating}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Mark Done
            </button>

            <button
              onClick={() => handleBulkPriority('URGENT')}
              disabled={isBulkOperating}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-rose-300 rounded font-medium transition-colors"
            >
              Set Urgent
            </button>

            <button
              onClick={() => handleBulkPriority('HIGH')}
              disabled={isBulkOperating}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded font-medium transition-colors"
            >
              Set High
            </button>

            {members.length > 0 && (
              <select
                value={bulkAssigneeId}
                onChange={(e) => {
                  setBulkAssigneeId(e.target.value);
                  handleBulkAssign(e.target.value);
                }}
                disabled={isBulkOperating}
                className="bg-neutral-800 border border-neutral-700 text-neutral-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-neutral-500"
              >
                <option value="">Bulk Assign To...</option>
                <option value="none">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.displayName || m.userId}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleBulkDelete}
              disabled={isBulkOperating}
              className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40 text-rose-300 rounded font-medium transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-neutral-400 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-[#101010] border border-[#222222] rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-[#202020] bg-[#141414] text-[11px] uppercase font-semibold text-neutral-500 select-none">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      sortedTasks.length > 0 && selectedIds.length === sortedTasks.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-[#333333] bg-[#1a1a1a] cursor-pointer"
                  />
                </th>
                <th
                  className="py-3 px-4 w-24 cursor-pointer hover:text-white"
                  onClick={() => handleSort('id')}
                >
                  ID {renderSortIcon('id')}
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white"
                  onClick={() => handleSort('title')}
                >
                  Title {renderSortIcon('title')}
                </th>
                <th
                  className="py-3 px-4 w-28 cursor-pointer hover:text-white"
                  onClick={() => handleSort('status')}
                >
                  Status {renderSortIcon('status')}
                </th>
                <th
                  className="py-3 px-4 w-24 cursor-pointer hover:text-white"
                  onClick={() => handleSort('priority')}
                >
                  Priority {renderSortIcon('priority')}
                </th>
                <th
                  className="py-3 px-4 w-36 cursor-pointer hover:text-white"
                  onClick={() => handleSort('assignee')}
                >
                  Assignee {renderSortIcon('assignee')}
                </th>
                <th
                  className="py-3 px-4 w-32 cursor-pointer hover:text-white"
                  onClick={() => handleSort('project')}
                >
                  Project {renderSortIcon('project')}
                </th>
                <th
                  className="py-3 px-4 w-28 cursor-pointer hover:text-white"
                  onClick={() => handleSort('dueDate')}
                >
                  Due Date {renderSortIcon('dueDate')}
                </th>
                <th className="py-3 px-4 w-28">Labels</th>
                <th
                  className="py-3 px-4 w-28 cursor-pointer hover:text-white"
                  onClick={() => handleSort('updatedAt')}
                >
                  Updated {renderSortIcon('updatedAt')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1c1c]">
              {sortedTasks.map((t) => {
                const isSelected = selectedIds.includes(t.id);
                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTask(t.id)}
                    className={`hover:bg-[#161616] cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#181818]' : ''
                    }`}
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectOne(e as any, t.id)}
                        className="rounded border-[#333333] bg-[#1a1a1a] cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-500">
                      TASK-{t.id.slice(0, 6)}
                    </td>
                    <td className="py-3 px-4 font-medium text-white max-w-xs">
                      <div className="flex items-center space-x-2">
                        <span className={`truncate ${t.status === 'DONE' ? 'line-through text-neutral-500' : ''}`}>
                          {t.title}
                        </span>
                        {t.isBlocked && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/60 text-rose-300 border border-rose-900/60 font-semibold flex items-center gap-1 shrink-0">
                            <ShieldAlert className="w-3 h-3 text-rose-400" /> Blocked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1a1a1a] border border-[#2e2e2e] text-neutral-300">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-semibold ${
                          t.priority === 'URGENT'
                            ? 'text-rose-400 font-bold'
                            : t.priority === 'HIGH'
                            ? 'text-amber-400 font-bold'
                            : t.priority === 'MEDIUM'
                            ? 'text-neutral-300'
                            : 'text-neutral-500'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-300">
                      {t.assignee ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="w-4 h-4 rounded-full bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-white uppercase shrink-0">
                            {t.assignee.displayName.charAt(0)}
                          </span>
                          <span className="truncate max-w-[100px]">{t.assignee.displayName}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-600 italic">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 truncate max-w-[120px]">
                      {t.project ? (
                        <span className="flex items-center gap-1 truncate">
                          <Folder className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span className="truncate">{t.project.name}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {t.dueDate ? (
                        <span
                          className={
                            isOverdue(t.dueDate) && t.status !== 'DONE'
                              ? 'text-rose-400 font-semibold'
                              : 'text-neutral-400'
                          }
                        >
                          {new Date(t.dueDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {t.labels && t.labels.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {t.labels.slice(0, 2).map((l: any, idx: number) => {
                            const labelObj = l.label || l;
                            return (
                              <span
                                key={labelObj.id || idx}
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium border truncate"
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
                          {t.labels.length > 2 && (
                            <span className="text-[9px] text-neutral-500">+{t.labels.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-500 text-[11px]">
                      {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      }) : '—'}
                    </td>
                  </tr>
                );
              })}

              {sortedTasks.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-neutral-600">
                    No tasks found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
