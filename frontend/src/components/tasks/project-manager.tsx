'use client';

import React, { useState } from 'react';
import { api, ProjectItem, ProjectHealthType, ProjectStatusType } from '@/lib/api';
import {
  Folder,
  Plus,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Flag,
  Trash2,
  ChevronRight,
  Target,
} from 'lucide-react';

interface ProjectManagerProps {
  projects: ProjectItem[];
  onSelectProject: (projectId: string) => void;
  onRefresh: () => void;
}

export function ProjectManager({
  projects,
  onSelectProject,
  onRefresh,
}: ProjectManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New milestone dialog state
  const [selectedForMilestone, setSelectedForMilestone] = useState<string | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');

  const getHealthBadge = (health: ProjectHealthType) => {
    switch (health) {
      case 'ON_TRACK':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-900/60 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ON TRACK
          </span>
        );
      case 'AT_RISK':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-900/60 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> AT RISK
          </span>
        );
      case 'OFF_TRACK':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-900/60 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" /> OFF TRACK
          </span>
        );
      default:
        return null;
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.createProject({
        name: projectName.trim(),
        description: projectDesc.trim() || undefined,
        targetDate: targetDate || undefined,
      });
      if (res.success) {
        setIsCreating(false);
        setProjectName('');
        setProjectDesc('');
        setTargetDate('');
        onRefresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecalculateProgress = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    try {
      await api.recalculateProjectProgress(projectId);
      onRefresh();
    } catch (err) {
      console.error('Recalculate progress failed:', err);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForMilestone || !milestoneTitle.trim()) return;
    try {
      const res = await api.addMilestone(selectedForMilestone, {
        title: milestoneTitle.trim(),
        targetDate: milestoneDate || undefined,
      });
      if (res.success) {
        setSelectedForMilestone(null);
        setMilestoneTitle('');
        setMilestoneDate('');
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to add milestone:', err);
    }
  };

  const handleToggleMilestone = async (
    e: React.MouseEvent,
    projectId: string,
    milestoneId: string,
    current: boolean
  ) => {
    e.stopPropagation();
    try {
      await api.updateMilestone(projectId, milestoneId, {
        isCompleted: !current,
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle milestone:', err);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete project "${name}"? All associated tasks will be removed.`)) return;
    try {
      await api.deleteProject(projectId);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#080808] text-neutral-200 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Projects & Milestones</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage long-term initiatives, deliverables, and automated health tracking.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="px-3.5 py-2 bg-neutral-200 hover:bg-white text-black text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Create Project Modal */}
      {isCreating && (
        <div className="p-5 rounded-xl bg-[#121212] border border-[#262626] space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#202020] pb-3">
            <h3 className="text-sm font-semibold text-white">Create New Project</h3>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs text-neutral-500 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                Project Name
              </label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Website Redesign, Mobile App v2..."
                className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-neutral-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                Description (Optional)
              </label>
              <textarea
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                rows={2}
                placeholder="Brief project goals and context..."
                className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-neutral-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                Target Completion Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !projectName.trim()}
                className="px-4 py-1.5 bg-neutral-200 text-black text-xs font-semibold rounded-lg hover:bg-white transition-colors disabled:opacity-40"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelectProject(p.id)}
            className="p-5 rounded-xl bg-[#101010] hover:bg-[#141414] border border-[#222222] hover:border-[#333333] transition-all cursor-pointer shadow-md space-y-4 group"
          >
            {/* Top Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#282828] flex items-center justify-center text-sm">
                  {p.icon || '📁'}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-neutral-100 transition-colors">
                    {p.name}
                  </h3>
                  <span className="text-[10px] font-mono text-neutral-500">
                    PROJECT-{p.id.slice(0, 6)}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {getHealthBadge(p.health)}
                <button
                  onClick={(e) => handleRecalculateProgress(e, p.id)}
                  title="Recalculate progress"
                  className="p-1 text-neutral-500 hover:text-neutral-200 hover:bg-[#202020] rounded transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => handleDeleteProject(e, p.id, p.name)}
                  title="Delete project"
                  className="p-1 text-neutral-500 hover:text-rose-400 hover:bg-[#202020] rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {p.description && (
              <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                {p.description}
              </p>
            )}

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-500 font-medium">Progress</span>
                <span className="text-white font-mono font-semibold">{p.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#1f1f1f] rounded-full overflow-hidden">
                <div
                  className="h-full bg-neutral-200 transition-all duration-300 rounded-full"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
            </div>

            {/* Milestones Section */}
            <div className="pt-3 border-t border-[#1c1c1c] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1">
                  <Flag className="w-3 h-3 text-neutral-500" /> Milestones ({p.milestones?.length || 0})
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedForMilestone(p.id);
                  }}
                  className="text-[10px] text-neutral-500 hover:text-white"
                >
                  + Add Milestone
                </button>
              </div>

              {/* Milestones list */}
              <div className="space-y-1">
                {(p.milestones || []).slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    onClick={(e) => handleToggleMilestone(e, p.id, m.id, m.isCompleted)}
                    className="flex items-center space-x-2 text-xs py-1 px-1.5 rounded hover:bg-[#1c1c1c] cursor-pointer"
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        m.isCompleted ? 'text-emerald-400' : 'text-neutral-600'
                      }`}
                    />
                    <span
                      className={`truncate flex-1 text-[11px] ${
                        m.isCompleted ? 'line-through text-neutral-500' : 'text-neutral-200'
                      }`}
                    >
                      {m.title}
                    </span>
                    {m.dueDate && (
                      <span className="text-[10px] text-neutral-500 shrink-0">
                        {new Date(m.dueDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Meta */}
            <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-[#1c1c1c]">
              <span>{p._count?.tasks || 0} tasks</span>
              {p.targetDate && (
                <span className="flex items-center gap-1 text-neutral-400">
                  <Calendar className="w-3 h-3" />
                  Target: {new Date(p.targetDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}

        {projects.length === 0 && !isCreating && (
          <div className="col-span-2 py-16 text-center text-xs text-neutral-600 space-y-2">
            <p>No projects created yet.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="text-white underline hover:text-neutral-300"
            >
              Create your first project
            </button>
          </div>
        )}
      </div>

      {/* Add Milestone Dialog */}
      {selectedForMilestone && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121212] border border-[#282828] rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-white">Add Deliverable Milestone</h3>
            <form onSubmit={handleAddMilestone} className="space-y-3">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Milestone Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="e.g. Beta release live, API audited..."
                  className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Due Date</label>
                <input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2a2a2a] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-neutral-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedForMilestone(null)}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!milestoneTitle.trim()}
                  className="px-3.5 py-1.5 bg-neutral-200 text-black text-xs font-semibold rounded-lg hover:bg-white disabled:opacity-40"
                >
                  Add Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
