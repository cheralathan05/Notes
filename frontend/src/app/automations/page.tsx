'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/app-shell';
import { Card, Button, Badge } from '@/components/ui';
import { api, AutomationItem } from '@/lib/api';
import {
  Cpu,
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Clock,
  ArrowRight,
  Filter,
  Layers,
  X,
  Bell,
  CheckSquare,
  MessageSquare,
} from 'lucide-react';

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Workflow Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('TASK_STATUS_CHANGED');
  const [conditionField, setConditionField] = useState('priority');
  const [conditionOperator, setConditionOperator] = useState('equals');
  const [conditionValue, setConditionValue] = useState('URGENT');
  const [actionType, setActionType] = useState('SEND_NOTIFICATION');
  const [actionMessage, setActionMessage] = useState('Alert: Urgent task status changed.');
  const [isCreating, setIsCreating] = useState(false);

  const loadAutomations = useCallback(async () => {
    try {
      const res = await api.getAutomations();
      if (res.success && res.data?.automations) {
        setAutomations(res.data.automations);
      }
    } catch (err) {
      console.error('Failed to load automations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await api.toggleAutomation(id, !current);
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isEnabled: !current } : a))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
      await api.deleteAutomation(id);
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const conditions = conditionField && conditionValue
        ? [{ field: conditionField, operator: conditionOperator, value: conditionValue }]
        : [];

      const actions = [
        {
          type: actionType,
          params: {
            title: `Automated Workflow: ${name}`,
            message: actionMessage,
          },
        },
      ];

      const res = await api.createAutomation({
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
        conditions,
        actions,
        isEnabled: true,
      });

      if (res.success && res.data?.automation) {
        setIsModalOpen(false);
        setName('');
        setDescription('');
        loadAutomations();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AppShell
      headerTitle="Visual Automation Builder"
      headerSubtitle="Deterministic workspace event triggers, multi-condition filters, and automated actions"
    >
      <div className="space-y-8 animate-fade-in font-sans">
        {/* Architectural Banner */}
        <div className="p-6 sm:p-7 rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="max-w-2xl space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#151515] border border-[#2D2D2D] font-mono text-[10px] uppercase text-[#FAFAFA]">
                <Cpu className="h-3 w-3 text-emerald-400" />
                EXECUTION PIPELINE // TRIGGER → CONDITION → ACTION
              </div>
              <h2 className="text-xl sm:text-2xl font-light text-[#FAFAFA] tracking-tight">
                Autonomous Workflow Engine
              </h2>
              <p className="text-xs text-[#737373] leading-relaxed">
                Build durable background automations without code. Automatically dispatch notifications, update downstream task metadata, and enforce team accountability.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="font-mono text-xs shrink-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Automation Rule
            </Button>
          </div>
        </div>

        {/* Workflow Rules List */}
        <div className="space-y-4">
          <div className="border-b border-[#222222] pb-3 flex items-center justify-between font-mono text-xs text-[#737373]">
            <span>CONFIGURED WORKFLOWS ({automations.length})</span>
            <span>REAL-TIME DISPATCH</span>
          </div>

          <div className="space-y-3 font-mono">
            {automations.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#737373] border border-dashed border-[#242424] rounded-[var(--radius-sm)]">
                No automations configured yet. Create a rule to automate routine tasks.
              </div>
            ) : (
              automations.map((rule) => (
                <Card
                  key={rule.id}
                  className={`p-5 bg-[#111111] border-[#262626] space-y-4 text-left transition-colors ${
                    !rule.isEnabled ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <h4 className="text-sm font-semibold text-[#FAFAFA] font-sans">
                          {rule.name}
                        </h4>
                        <Badge variant={rule.isEnabled ? 'success' : 'secondary'}>
                          {rule.isEnabled ? 'ACTIVE' : 'PAUSED'}
                        </Badge>
                      </div>
                      {rule.description && (
                        <p className="text-xs text-[#737373] font-sans">
                          {rule.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(rule.id, rule.isEnabled)}
                        className="text-[11px] h-7 px-2.5"
                      >
                        {rule.isEnabled ? 'Pause' : 'Activate'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        className="p-1.5 text-[#737373] hover:text-red-400 transition-colors"
                        title="Delete automation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Flow Diagram Strip */}
                  <div className="p-3 rounded-[var(--radius-xs)] bg-[#151515] border border-[#222222] flex flex-wrap items-center gap-2 text-xs">
                    {/* Trigger */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA]">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span className="text-[10px] text-[#737373]">TRIGGER:</span>
                      <span className="font-semibold">{rule.triggerType}</span>
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-[#555555]" />

                    {/* Conditions */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA]">
                      <Filter className="h-3 w-3 text-cyan-400" />
                      <span className="text-[10px] text-[#737373]">CONDITIONS:</span>
                      {rule.conditions && rule.conditions.length > 0 ? (
                        rule.conditions.map((c, i) => (
                          <span key={i} className="font-semibold">
                            {c.field} {c.operator} {String(c.value)}
                          </span>
                        ))
                      ) : (
                        <span>Always Match</span>
                      )}
                    </div>

                    <ArrowRight className="h-3.5 w-3.5 text-[#555555]" />

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA]">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] text-[#737373]">ACTION:</span>
                      {rule.actions && rule.actions.length > 0 ? (
                        <span className="font-semibold">{rule.actions[0].type}</span>
                      ) : (
                        <span>None</span>
                      )}
                    </div>
                  </div>

                  {/* Telemetry Footer */}
                  <div className="flex items-center justify-between text-[11px] text-[#737373] pt-1">
                    <span>TOTAL EXECUTIONS: {rule.executionCount}</span>
                    <span>
                      LAST RUN:{' '}
                      {rule.lastRunAt
                        ? new Date(rule.lastRunAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never'}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Create Automation Modal ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#121212] border border-[#2D2D2D] rounded-[var(--radius-sm)] p-6 space-y-4 font-mono shadow-2xl animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <h3 className="text-sm font-semibold text-[#FAFAFA]">CREATE AUTOMATION RULE</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#737373] hover:text-[#FAFAFA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] text-[#737373]">WORKFLOW NAME *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alert Lead on Urgent Priority Changes"
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] placeholder-[#555555] focus:outline-none focus:border-[#FAFAFA]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#737373]">DESCRIPTION</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Operational purpose of this rule"
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] placeholder-[#555555] focus:outline-none focus:border-[#FAFAFA]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#737373]">EVENT TRIGGER</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                >
                  <option value="TASK_STATUS_CHANGED">When a Task Status Changes</option>
                  <option value="TASK_CREATED">When a New Task is Created</option>
                  <option value="TASK_OVERDUE">When a Task Becomes Overdue</option>
                  <option value="MILESTONE_COMPLETED">When a Milestone is Completed</option>
                  <option value="NOTE_PUBLISHED">When a Document is Published</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#737373]">FILTER CONDITION</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={conditionField}
                    onChange={(e) => setConditionField(e.target.value)}
                    className="bg-[#181818] border border-[#333333] rounded-[2px] px-2 py-1 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                  >
                    <option value="priority">Priority</option>
                    <option value="status">Status</option>
                  </select>

                  <select
                    value={conditionOperator}
                    onChange={(e) => setConditionOperator(e.target.value)}
                    className="bg-[#181818] border border-[#333333] rounded-[2px] px-2 py-1 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                  >
                    <option value="equals">Equals</option>
                    <option value="not_equals">Does Not Equal</option>
                  </select>

                  <input
                    type="text"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    placeholder="URGENT"
                    className="bg-[#181818] border border-[#333333] rounded-[2px] px-2 py-1 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#737373]">AUTOMATED ACTION</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                >
                  <option value="SEND_NOTIFICATION">Dispatch In-App Notification Alert</option>
                  <option value="ADD_COMMENT">Post Automated Comment to Task</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#737373]">MESSAGE PAYLOAD</label>
                <input
                  type="text"
                  value={actionMessage}
                  onChange={(e) => setActionMessage(e.target.value)}
                  className="w-full bg-[#181818] border border-[#333333] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isCreating}
                >
                  Save Automation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
