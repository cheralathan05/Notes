'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';

interface TaskListProps {
  tasks: TaskItem[];
  projects: ProjectItem[];
  onSelectTask: (taskId: string) => void;
  onRefresh: () => void;
}

export function TaskList({
  tasks,
  projects,
  onSelectTask,
  onRefresh,
}: TaskListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterProject !== 'all' && t.projectId !== filterProject) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTasks.map((t) => t.id));
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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} tasks?`)) return;
    setIsBulkOperating(true);
    try {
      await api.bulkTasks(selectedIds, 'delete');
      setSelectedIds([]);
      onRefresh();
    } finally {
      setIsBulkOperating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#080808] text-neutral-200 space-y-4">
      {/* Search and Filters Bar */}
      <div className="p-3 bg-[#101010] border border-[#222222] rounded-xl flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title..."
            className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-neutral-500 placeholder:text-neutral-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-[#181818] border border-[#2a2a2a] text-xs text-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
        >
          <option value="all">All Statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="DONE">Done</option>
          <option value="BACKLOG">Backlog</option>
        </select>

        {/* Priority Filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-[#181818] border border-[#2a2a2a] text-xs text-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
        >
          <option value="all">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {/* Project Filter */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="bg-[#181818] border border-[#2a2a2a] text-xs text-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-neutral-500"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Sticky Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="p-2.5 px-4 bg-[#141414] border border-[#2e2e2e] rounded-xl flex items-center justify-between text-xs shadow-lg animate-in fade-in duration-150">
          <span className="font-semibold text-white">
            {selectedIds.length} task(s) selected
          </span>

          <div className="flex items-center space-x-2">
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
      <div className="bg-[#101010] border border-[#222222] rounded-xl overflow-hidden shadow">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#202020] bg-[#141414] text-[11px] uppercase font-semibold text-neutral-500">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  checked={
                    filteredTasks.length > 0 && selectedIds.length === filteredTasks.length
                  }
                  onChange={toggleSelectAll}
                  className="rounded border-[#333333] bg-[#1a1a1a]"
                />
              </th>
              <th className="py-3 px-4 w-24">ID</th>
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-4 w-28">Status</th>
              <th className="py-3 px-4 w-24">Priority</th>
              <th className="py-3 px-4 w-36">Project</th>
              <th className="py-3 px-4 w-28">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1c1c1c]">
            {filteredTasks.map((t) => {
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
                      className="rounded border-[#333333] bg-[#1a1a1a]"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-neutral-500">
                    TASK-{t.id.slice(0, 6)}
                  </td>
                  <td className="py-3 px-4 font-medium text-white">
                    <div className="flex items-center space-x-2">
                      <span className={t.status === 'DONE' ? 'line-through text-neutral-500' : ''}>
                        {t.title}
                      </span>
                      {t.isBlocked && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/60 text-rose-300 border border-rose-900/60 font-semibold flex items-center gap-1">
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
                          ? 'text-rose-400'
                          : t.priority === 'HIGH'
                          ? 'text-amber-400'
                          : 'text-neutral-400'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-neutral-400 truncate max-w-[140px]">
                    {t.project?.name || '—'}
                  </td>
                  <td className="py-3 px-4 text-neutral-400 text-[11px]">
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                  </td>
                </tr>
              );
            })}

            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-neutral-600">
                  No tasks found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
