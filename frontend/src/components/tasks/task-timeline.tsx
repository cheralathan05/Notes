'use client';

import React, { useMemo } from 'react';
import { TaskItem } from '@/lib/api';
import { Badge } from '@/components/ui';
import {
  Calendar,
  Clock,
  Ban,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface TaskTimelineProps {
  tasks: TaskItem[];
  onSelectTask: (taskId: string) => void;
}

export function TaskTimeline({ tasks, onSelectTask }: TaskTimelineProps) {
  // Filter tasks with dates
  const scheduledTasks = useMemo(() => {
    return tasks
      .filter((t) => t.dueDate || t.startDate)
      .sort((a, b) => {
        const dateA = new Date(a.startDate || a.dueDate!).getTime();
        const dateB = new Date(b.startDate || b.dueDate!).getTime();
        return dateA - dateB;
      });
  }, [tasks]);

  // Determine timeline window (earliest date to latest date, min 14 days)
  const { startDate, totalDays, dayHeaders } = useMemo(() => {
    const now = new Date();
    let minTime = now.getTime();
    let maxTime = now.getTime() + 14 * 24 * 60 * 60 * 1000;

    for (const t of scheduledTasks) {
      if (t.startDate) {
        minTime = Math.min(minTime, new Date(t.startDate).getTime());
      }
      if (t.dueDate) {
        maxTime = Math.max(maxTime, new Date(t.dueDate).getTime());
      }
    }

    const start = new Date(minTime);
    start.setHours(0, 0, 0, 0);

    const end = new Date(maxTime);
    end.setHours(23, 59, 59, 999);

    const days = Math.max(14, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));

    const headers: Array<{ date: Date; dateStr: string; label: string }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      headers.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        label: `${d.toLocaleDateString([], { month: 'short' })} ${d.getDate()}`,
      });
    }

    return { startDate: start, totalDays: days, dayHeaders: headers };
  }, [scheduledTasks]);

  return (
    <div className="space-y-4 font-mono text-left">
      <div className="p-4 bg-[#101010] border border-[#262626] rounded-[var(--radius-sm)] flex items-center justify-between text-xs text-[#737373]">
        <div className="flex items-center gap-2 text-[#FAFAFA] font-semibold">
          <Calendar className="h-4 w-4" />
          <span>TIMELINE & GANTT SCHEDULE VIEW</span>
        </div>
        <span>{scheduledTasks.length} scheduled work items</span>
      </div>

      {scheduledTasks.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#737373] border border-dashed border-[#262626] rounded-[var(--radius-sm)]">
          No tasks with start or due dates scheduled yet. Set task start or due dates to plot timeline.
        </div>
      ) : (
        <div className="border border-[#262626] rounded-[var(--radius-sm)] bg-[#0C0C0C] overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Timeline Day Header */}
            <div className="grid grid-cols-12 border-b border-[#222222] bg-[#141414] py-2 text-[10px] text-[#737373] text-center font-semibold">
              <div className="col-span-4 text-left pl-4">TASK OBJECTIVE</div>
              <div className="col-span-8 flex justify-between pr-4">
                {dayHeaders.slice(0, 8).map((h, i) => (
                  <span key={i}>{h.label}</span>
                ))}
              </div>
            </div>

            {/* Task Rows */}
            <div className="divide-y divide-[#1A1A1A]">
              {scheduledTasks.map((task) => {
                const taskStart = task.startDate ? new Date(task.startDate) : task.dueDate ? new Date(task.dueDate) : startDate;
                const taskEnd = task.dueDate ? new Date(task.dueDate) : taskStart;

                const startOffsetDays = Math.max(0, Math.floor((taskStart.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
                const durationDays = Math.max(1, Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (24 * 60 * 60 * 1000)));

                const leftPercent = Math.min(95, Math.max(0, (startOffsetDays / totalDays) * 100));
                const widthPercent = Math.min(100 - leftPercent, Math.max(5, (durationDays / totalDays) * 100));

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className="grid grid-cols-12 py-3 px-4 hover:bg-[#121212] cursor-pointer transition-colors items-center"
                  >
                    {/* Left Column: Task Info */}
                    <div className="col-span-4 pr-3 truncate space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#737373]">{task.id.slice(0, 8)}</span>
                        <Badge variant={task.priority === 'URGENT' ? 'default' : 'secondary'}>
                          {task.priority}
                        </Badge>
                        {task.isBlocked && <Ban className="h-3 w-3 text-amber-400 shrink-0" />}
                      </div>
                      <h4 className="text-xs font-semibold text-[#FAFAFA] truncate font-sans">
                        {task.title}
                      </h4>
                    </div>

                    {/* Right Column: Gantt Bar */}
                    <div className="col-span-8 relative h-7 flex items-center bg-[#111111] rounded-[2px] p-0.5">
                      <div
                        className={`absolute h-6 rounded-[2px] flex items-center justify-between px-2 text-[10px] truncate transition-all ${
                          task.status === 'DONE'
                            ? 'bg-[#1C1C1C] border border-[#333333] text-[#777777] line-through'
                            : task.priority === 'URGENT'
                            ? 'bg-red-950/50 border border-red-800 text-red-200'
                            : 'bg-[#FAFAFA] text-[#0C0C0C] font-semibold'
                        }`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          minWidth: '60px',
                        }}
                      >
                        <span className="truncate">{durationDays}d</span>
                        {task.status === 'DONE' && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
