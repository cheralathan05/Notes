'use client';

import React, { useState, useMemo } from 'react';
import { TaskItem, TaskPriorityType, TaskStatusType } from '@/lib/api';
import { Badge } from '@/components/ui';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Ban,
  CheckCircle2,
} from 'lucide-react';

interface TaskCalendarProps {
  tasks: TaskItem[];
  onSelectTask: (taskId: string) => void;
  onQuickCreateDate?: (dateStr: string) => void;
}

export function TaskCalendar({ tasks, onSelectTask, onQuickCreateDate }: TaskCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Build grid of days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
    const adjustedFirstDay = (firstDayIndex + 6) % 7; // 0 is Mon
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to reach multiple of 7
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        const dateStr = d.toISOString().split('T')[0];
        days.push({
          date: d,
          dateStr,
          dayNumber: i,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
        });
      }
    }

    return days;
  }, [year, month]);

  // Index tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      if (t.dueDate) {
        const dateKey = new Date(t.dueDate).toISOString().split('T')[0];
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(t);
      }
    }
    return map;
  }, [tasks]);

  return (
    <div className="space-y-4 font-mono">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#101010] border border-[#262626] rounded-[var(--radius-sm)]">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-5 w-5 text-[#FAFAFA]" />
          <h2 className="text-base font-semibold text-[#FAFAFA]">
            {monthNames[month]} {year}
          </h2>
          <button
            type="button"
            onClick={handleToday}
            className="px-2 py-0.5 rounded-[2px] bg-[#181818] border border-[#333333] hover:border-[#FAFAFA] text-[10px] text-[#FAFAFA] transition-colors"
          >
            TODAY
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-[var(--radius-xs)] border border-[#2B2B2B] hover:border-[#FAFAFA] text-[#737373] hover:text-[#FAFAFA] transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-[var(--radius-xs)] border border-[#2B2B2B] hover:border-[#FAFAFA] text-[#737373] hover:text-[#FAFAFA] transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 7-Day Day Header */}
      <div className="grid grid-cols-7 gap-px bg-[#262626] border border-[#262626] rounded-t-[var(--radius-sm)] overflow-hidden text-center text-xs text-[#737373] py-2 font-semibold">
        <span>MON</span>
        <span>TUE</span>
        <span>WED</span>
        <span>THU</span>
        <span>FRI</span>
        <span>SAT</span>
        <span>SUN</span>
      </div>

      {/* Grid of Day Cells */}
      <div className="grid grid-cols-7 gap-px bg-[#202020] border border-[#262626] rounded-b-[var(--radius-sm)] overflow-hidden">
        {calendarDays.map((day) => {
          const dayTasks = tasksByDate.get(day.dateStr) || [];
          return (
            <div
              key={day.dateStr}
              className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors ${
                day.isCurrentMonth ? 'bg-[#0E0E0E]' : 'bg-[#080808] opacity-50'
              } ${day.isToday ? 'ring-1 ring-inset ring-[#FAFAFA]' : ''}`}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`h-5 w-5 rounded-[2px] flex items-center justify-center text-[11px] font-semibold ${
                    day.isToday
                      ? 'bg-[#FAFAFA] text-[#080808]'
                      : day.isCurrentMonth
                      ? 'text-[#A3A3A3]'
                      : 'text-[#555555]'
                  }`}
                >
                  {day.dayNumber}
                </span>

                {onQuickCreateDate && (
                  <button
                    type="button"
                    onClick={() => onQuickCreateDate(day.dateStr)}
                    className="opacity-0 hover:opacity-100 p-0.5 text-[#737373] hover:text-[#FAFAFA] transition-opacity"
                    title={`Add task for ${day.dateStr}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Day Tasks List */}
              <div className="space-y-1 my-1 overflow-y-auto max-h-24">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className={`p-1.5 rounded-[2px] text-[10px] border cursor-pointer truncate transition-colors text-left flex items-center justify-between gap-1 ${
                      task.status === 'DONE'
                        ? 'bg-[#141414] border-[#222222] text-[#666666] line-through'
                        : task.priority === 'URGENT'
                        ? 'bg-red-950/30 border-red-900/60 text-red-300'
                        : 'bg-[#181818] border-[#2E2E2E] text-[#FAFAFA] hover:border-[#FAFAFA]'
                    }`}
                    title={task.title}
                  >
                    <span className="truncate">{task.title}</span>
                    {task.isBlocked && <Ban className="h-2.5 w-2.5 text-amber-400 shrink-0" />}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[9px] text-[#737373] text-center">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>

              <div />
            </div>
          );
        })}
      </div>
    </div>
  );
}
