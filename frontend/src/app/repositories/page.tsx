'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, RepositoryItem, ProjectItem } from '@/lib/api';
import { Button, Card, Badge, Modal } from '@/components/ui';
import {
  GitBranch,
  FolderGit2,
  Plus,
  Terminal,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Folder,
  Code,
} from 'lucide-react';

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [localPath, setLocalPath] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [repoRes, projRes] = await Promise.all([
        api.listRepositories(),
        api.getProjects(),
      ]);

      if (repoRes.success && repoRes.data?.repositories) {
        setRepositories(repoRes.data.repositories);
      }
      if (projRes.success && projRes.data?.projects) {
        setProjects(projRes.data.projects);
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.createRepository({
        name: name.trim(),
        gitUrl: gitUrl.trim() || undefined,
        defaultBranch: defaultBranch.trim() || 'main',
        localPath: localPath.trim() || undefined,
        projectId: projectId || undefined,
        description: description.trim() || undefined,
      });

      if (res.success) {
        setIsCreateOpen(false);
        setName('');
        setGitUrl('');
        setLocalPath('');
        setDescription('');
        loadData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, repoName: string) => {
    if (!confirm(`Are you sure you want to disconnect repository "${repoName}"?`)) return;
    try {
      const res = await api.deleteRepository(id);
      if (res.success) {
        loadData();
      }
    } catch (err) {
      console.error('Failed to remove repository:', err);
    }
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <AppShell>
      <div className="flex-1 flex flex-col h-full bg-[#080808] text-neutral-200 overflow-y-auto select-none p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222222] pb-6">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <FolderGit2 className="w-5 h-5 text-neutral-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">Repositories & Codebases</h1>
              <Badge variant="default">{repositories.length} Active</Badge>
            </div>
            <p className="text-xs text-neutral-400">
              Link your Git repositories to Atlas tasks for automated test verification, commit tracking, and CLI synchronization.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="text-xs font-semibold bg-neutral-200 text-black hover:bg-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Connect Repository
            </Button>
          </div>
        </div>

        {/* CLI Quick Connect Terminal Banner */}
        <div className="bg-[#101010] border border-[#222222] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Connect Directly from your VS Code Terminal
              </h3>
            </div>
            <span className="text-[11px] text-neutral-500 font-mono">atlas connect</span>
          </div>
          <p className="text-xs text-neutral-400">
            Open your terminal inside any local Git project directory and run:
          </p>
          <div className="flex items-center justify-between bg-[#080808] border border-[#262626] rounded-lg px-4 py-2.5 font-mono text-xs text-neutral-300">
            <code>atlas connect</code>
            <button
              onClick={() => copyCommand('atlas connect')}
              className="text-neutral-500 hover:text-white flex items-center space-x-1"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{copiedCmd ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Repositories Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
          </div>
        ) : repositories.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#222222] rounded-xl space-y-3">
            <FolderGit2 className="w-10 h-10 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-semibold text-neutral-300">No repositories registered yet</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Connect your first repository through the web interface or via the Atlas CLI to link code commits with tasks.
            </p>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="mt-2 text-xs">
              <Plus className="w-4 h-4 mr-1.5" />
              Register Repository
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repositories.map((repo) => (
              <div
                key={repo.id}
                className="bg-[#111111] border border-[#222222] hover:border-[#333333] rounded-xl p-5 space-y-4 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <FolderGit2 className="w-4 h-4 text-neutral-400" />
                      <h4 className="text-sm font-bold text-white tracking-tight">{repo.name}</h4>
                    </div>
                    {repo.description && (
                      <p className="text-xs text-neutral-400 line-clamp-2">{repo.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(repo.id, repo.name)}
                    className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                    title="Disconnect repository"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs text-neutral-400 pt-2 border-t border-[#1C1C1C]">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Default Branch:</span>
                    <span className="font-mono text-neutral-300 flex items-center space-x-1">
                      <GitBranch className="w-3 h-3 text-neutral-500" />
                      <span>{repo.defaultBranch}</span>
                    </span>
                  </div>

                  {repo.project && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Linked Project:</span>
                      <span className="text-neutral-300 font-medium truncate max-w-[150px]">
                        {repo.project.name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Tasks Linked:</span>
                    <Badge variant="muted">{repo._count?.tasks || 0} tasks</Badge>
                  </div>

                  {repo.localPath && (
                    <div className="pt-1">
                      <span className="text-[10px] text-neutral-500 block truncate font-mono">
                        {repo.localPath}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Register Repository Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#111111] border border-[#262626] rounded-xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <h3 className="text-sm font-semibold text-white">Register Repository</h3>
                <button onClick={() => setIsCreateOpen(false)} className="text-neutral-500 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Repository Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. backend-api, mobile-client"
                    className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Git Remote URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="e.g. https://github.com/my-org/repo.git"
                    className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400 font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Default Branch
                    </label>
                    <input
                      type="text"
                      value={defaultBranch}
                      onChange={(e) => setDefaultBranch(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                      Linked Project
                    </label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white focus:outline-none focus:border-neutral-400"
                    >
                      <option value="">None</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description of this codebase"
                    className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#222222]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting}
                    className="text-xs font-semibold bg-neutral-200 text-black hover:bg-white"
                  >
                    {isSubmitting ? 'Registering...' : 'Register Repository'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
