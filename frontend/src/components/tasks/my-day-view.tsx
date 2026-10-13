'use client';

import React, { useState, useEffect } from 'react';
import { api, MyDayData, TaskItem } from '@/lib/api';
import {
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Sun,
  Check,
  Folder,
} from 'lucide-react';

interface MyDayViewProps {
  onSelectTask: (taskId: string) => void;
  onRefresh: () => void;
}

export function MyDayView({ onSelectTask, onRefresh }: MyDayViewProps) {
  const [data, setData] = useState<MyDayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyDay();
  }, []);

  const loadMyDay = async () => {
    setLoading(true);
    try {
      const res = await api.getMyDayTasks();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load My Day data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDone = async (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    try {
      await api.updateTask(task.id, { status: nextStatus });
      await loadMyDay();
      onRefresh();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const renderSection = (
    title: string,
    items: TaskItem[],
    icon: React.ReactNode,
    badgeColor?: string,
    isCompletedSection?: boolean
  ) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          {icon}
          <h3 className="text-xs font-semibold text-neutral-200 tracking-wider uppercase">
            {title}
          </h3>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
              badgeColor || 'bg-[#1c1c1c] text-neutral-400 border border-[#2c2c2c]'
            }`}
          >
            {items.length}
          </span>
        </div>

        <div className="space-y-2">
          {items.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelectTask(t.id)}
              className="p-3.5 rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#222222] hover:border-[#333333] transition-all cursor-pointer flex items-center justify-between group shadow-sm"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <button
                  onClick={(e) => handleToggleDone(e, t)}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    t.status === 'DONE'
                      ? 'bg-neutral-200 border-white text-black'
                      : 'border-neutral-600 hover:border-neutral-400 bg-transparent'
                  }`}
                >
                  {t.status === 'DONE' && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                <div className="min-w-0">
                  <p
                    className={`text-xs font-medium truncate ${
                      t.status === 'DONE' ? 'line-through text-neutral-500' : 'text-neutral-100'
                    }`}
                  >
                    {t.title}
                  </p>
                  <div className="flex items-center space-x-2 text-[10px] text-neutral-500 mt-0.5">
                    <span className="font-mono">TASK-{t.id.slice(0, 6)}</span>
                    {t.project && (
                      <span className="flex items-center gap-1 text-neutral-400 truncate max-w-[120px]">
                        • <Folder className="w-3 h-3 text-neutral-500" />
                        {t.project.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {t.isBlocked && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/40 text-rose-300 border border-rose-900/40 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-400" /> Blocked
                  </span>
                )}
                {t.dueDate && (
                  <span className="text-[11px] text-neutral-400">
                    {new Date(t.dueDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <p className="text-xs text-neutral-600 py-3 italic">No tasks in this section.</p>
          )}
        </div>
      </div>
    );
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#080808] text-neutral-200 space-y-8 max-w-5xl mx-auto w-full">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-[#141414] to-[#0F0F0F] border border-[#262626] shadow-xl flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-white">
            <Sun className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold tracking-tight">My Day — Smart Focus</h1>
          </div>
          <p className="text-xs text-neutral-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-neutral-500 block text-[10px] uppercase font-bold">Today</span>
            <span className="text-white font-bold text-base">{data?.stats.todayCount || 0}</span>
          </div>
          <div className="w-px h-8 bg-neutral-800" />
          <div className="text-right">
            <span className="text-rose-400 block text-[10px] uppercase font-bold">Overdue</span>
            <span className="text-rose-400 font-bold text-base">{data?.stats.overdueCount || 0}</span>
          </div>
          <div className="w-px h-8 bg-neutral-800" />
          <div className="text-right">
            <span className="text-emerald-400 block text-[10px] uppercase font-bold">Done</span>
            <span className="text-emerald-400 font-bold text-base">{data?.stats.completedCount || 0}</span>
          </div>
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Overdue (Urgent Attention) */}
        {renderSection(
          'Overdue Tasks',
          data?.overdue || [],
          <AlertTriangle className="w-4 h-4 text-rose-400" />,
          'bg-rose-950/80 text-rose-300 border border-rose-800'
        )}

        {/* Due Today */}
        {renderSection(
          'Due Today',
          data?.today || [],
          <Calendar className="w-4 h-4 text-amber-400" />,
          'bg-amber-950/80 text-amber-300 border border-amber-800'
        )}

        {/* Waiting on Others (Blocked) */}
        {renderSection(
          'Waiting on Others (Blocked)',
          data?.waitingOnOthers || [],
          <ShieldAlert className="w-4 h-4 text-neutral-400" />
        )}

        {/* Upcoming */}
        {renderSection(
          'Upcoming Deadlines',
          data?.upcoming || [],
          <Clock className="w-4 h-4 text-neutral-400" />
        )}
      </div>

      {/* Completed Section */}
      <div className="pt-6 border-t border-[#1f1f1f]">
        {renderSection(
          'Completed Today',
          data?.completed || [],
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          'bg-emerald-950/80 text-emerald-300 border border-emerald-800',
          true
        )}
      </div>
    </div>
  );
}
