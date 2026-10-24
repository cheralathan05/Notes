'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/app-shell';
import {
  api,
  RepositoryItem,
  RepositoryDetail,
  ProjectItem,
  TaskItem,
  GitBranchItem,
  GitCommitItem,
  GitWorkingTreeStatus,
  GitHubRepoItem,
  GitHubActivity,
} from '@/lib/api';
import { Badge, Button } from '@/components/ui';
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
  Search,
  Filter,
  ArrowUpDown,
  FileCode,
  GitCommit,
  Layers,
  FileText,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  X,
  SlidersHorizontal,
  Link as LinkIcon,
  Unlink,
  CheckSquare,
  GitPullRequest,
  Lock,
  Globe,
  Key,
} from 'lucide-react';

function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'tasks'>('updated');

  // Modals & Panels
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectTab, setConnectTab] = useState<'cli' | 'local' | 'remote' | 'github'>('cli');
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'branches' | 'commits' | 'changes' | 'tasks' | 'github'>('overview');

  // GitHub Integration state
  const [gitHubStatus, setGitHubStatus] = useState<{
    connected: boolean;
    accountName?: string;
    avatarUrl?: string;
    scopes?: string;
    lastSyncedAt?: string;
  } | null>(null);
  const [gitHubRepos, setGitHubRepos] = useState<GitHubRepoItem[]>([]);
  const [gitHubLoading, setGitHubLoading] = useState(false);
  const [gitHubToken, setGitHubToken] = useState('');
  const [gitHubError, setGitHubError] = useState<string | null>(null);
  const [gitHubSearchQuery, setGitHubSearchQuery] = useState('');
  const [gitHubActivity, setGitHubActivity] = useState<GitHubActivity | null>(null);
  const [gitHubActivityLoading, setGitHubActivityLoading] = useState(false);
  const [importingRepoName, setImportingRepoName] = useState<string | null>(null);

  // Inspector detailed data
  const [selectedRepoDetail, setSelectedRepoDetail] = useState<RepositoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [branches, setBranches] = useState<GitBranchItem[]>([]);
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [treeStatus, setTreeStatus] = useState<GitWorkingTreeStatus | null>(null);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Form states
  const [repoName, setRepoName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [localPath, setLocalPath] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Task linking in inspector
  const [selectedTaskToLink, setSelectedTaskToLink] = useState('');
  const [taskBranchName, setTaskBranchName] = useState('');
  const [isLinkingTask, setIsLinkingTask] = useState(false);

  // Load initial repository, workspace, and GitHub connection data
  const loadData = async () => {
    setLoading(true);
    try {
      const [repoRes, projRes, taskRes, ghStatusRes] = await Promise.all([
        api.listRepositories(),
        api.getProjects(),
        api.getTasks(),
        api.getGitHubStatus().catch(() => ({ success: false, data: null })),
      ]);

      if (repoRes.success && repoRes.data?.repositories) {
        setRepositories(repoRes.data.repositories);
      }
      if (projRes.success && projRes.data?.projects) {
        setProjects(projRes.data.projects);
      }
      if (taskRes.success && taskRes.data?.tasks) {
        setTasks(taskRes.data.tasks);
      }
      if (ghStatusRes.success && ghStatusRes.data) {
        setGitHubStatus(ghStatusRes.data as any);
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

  useEffect(() => {
    const handleWsChange = () => {
      loadData();
    };
    window.addEventListener('kronos:workspace-changed', handleWsChange);
    return () => window.removeEventListener('kronos:workspace-changed', handleWsChange);
  }, []);

  const loadGitHubRepos = async () => {
    setGitHubLoading(true);
    setGitHubError(null);
    try {
      const res = await api.listGitHubRepos();
      if (res.success && res.data) {
        setGitHubRepos(res.data.repositories);
      } else {
        setGitHubError(res.error?.message || 'Failed to list GitHub repositories');
      }
    } catch (err: any) {
      setGitHubError(err.message || 'Error fetching GitHub repositories');
    } finally {
      setGitHubLoading(false);
    }
  };

  const handleConnectGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gitHubToken.trim()) return;
    setIsSubmitting(true);
    setGitHubError(null);
    try {
      const res = await api.connectGitHub(gitHubToken.trim());
      if (res.success && res.data) {
        setGitHubStatus({
          connected: true,
          accountName: (res.data as any).accountName,
          avatarUrl: (res.data as any).avatarUrl,
          scopes: (res.data as any).scopes,
        });
        setGitHubToken('');
        // Load repositories immediately
        await loadGitHubRepos();
      } else {
        setGitHubError(res.error?.message || 'Failed to connect GitHub account');
      }
    } catch (err: any) {
      setGitHubError(err.message || 'Connection failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    if (!confirm('Disconnect GitHub account from this workspace?')) return;
    try {
      await api.disconnectGitHub();
      setGitHubStatus({ connected: false });
      setGitHubRepos([]);
      setGitHubActivity(null);
    } catch (err: any) {
      console.error('Failed to disconnect GitHub:', err);
    }
  };

  const handleImportGitHubRepo = async (repo: GitHubRepoItem) => {
    setImportingRepoName(repo.fullName);
    setGitHubError(null);
    try {
      const res = await api.importGitHubRepo({
        fullName: repo.fullName,
        projectId: projectId || undefined,
      });
      if (res.success) {
        await loadData();
        setIsConnectModalOpen(false);
      } else {
        setGitHubError(res.error?.message || 'Failed to import repository');
      }
    } catch (err: any) {
      setGitHubError(err.message || 'Import failed');
    } finally {
      setImportingRepoName(null);
    }
  };

  // Load deep details when a repository is selected
  const openRepositoryDetails = async (repoId: string) => {
    setSelectedRepoId(repoId);
    setActiveDetailTab('overview');
    setDetailLoading(true);
    setSelectedDiffFile(null);
    setDiffContent(null);
    setGitHubActivity(null);

    try {
      const [detailRes, branchRes, commitRes, statusRes] = await Promise.all([
        api.getRepository(repoId),
        api.getRepositoryBranches(repoId),
        api.getRepositoryCommits(repoId, 30),
        api.getRepositoryStatus(repoId),
      ]);

      if (detailRes.success && detailRes.data?.repository) {
        const repo = detailRes.data.repository;
        setSelectedRepoDetail(repo);

        // If repository is linked to GitHub, fetch remote PRs and commits
        if (repo.gitUrl && repo.gitUrl.includes('github.com')) {
          const match = repo.gitUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
          if (match) {
            const [, owner, repoName] = match;
            setGitHubActivityLoading(true);
            api.getGitHubActivity(owner, repoName)
              .then((actRes) => {
                if (actRes.success && actRes.data) {
                  setGitHubActivity(actRes.data);
                }
              })
              .catch(() => {})
              .finally(() => setGitHubActivityLoading(false));
          }
        }
      }
      if (branchRes.success && branchRes.data?.branches) {
        setBranches(branchRes.data.branches);
      }
      if (commitRes.success && commitRes.data?.commits) {
        setCommits(commitRes.data.commits);
      }
      if (statusRes.success && statusRes.data?.status) {
        setTreeStatus(statusRes.data.status);
      }
    } catch (err) {
      console.error('Error fetching repository details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Fetch diff for a specific changed file
  const inspectFileDiff = async (filePath: string) => {
    if (!selectedRepoId) return;
    setSelectedDiffFile(filePath);
    setDiffLoading(true);
    try {
      const res = await api.getRepositoryDiff(selectedRepoId, filePath);
      if (res.success && res.data) {
        setDiffContent(res.data.diff);
      }
    } catch (err) {
      console.error('Failed to get file diff:', err);
      setDiffContent('Error reading unified diff for this file.');
    } finally {
      setDiffLoading(false);
    }
  };

  // Sync a single repository
  const handleSyncRepository = async (repoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSyncingRepoId(repoId);
    try {
      const res = await api.syncRepository(repoId);
      if (res.success) {
        await loadData();
        if (selectedRepoId === repoId) {
          await openRepositoryDetails(repoId);
        }
      }
    } catch (err) {
      console.error('Failed to sync repository:', err);
    } finally {
      setSyncingRepoId(null);
    }
  };

  // Register new repository
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoName.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await api.createRepository({
        name: repoName.trim(),
        gitUrl: gitUrl.trim() || undefined,
        defaultBranch: defaultBranch.trim() || 'main',
        localPath: localPath.trim() || undefined,
        projectId: projectId || undefined,
        description: description.trim() || undefined,
      });

      if (res.success) {
        setIsConnectModalOpen(false);
        setRepoName('');
        setGitUrl('');
        setLocalPath('');
        setDescription('');
        await loadData();
      } else {
        setErrorMessage(res.error?.message || 'Failed to register repository');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error connecting repository');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Disconnect repository
  const handleDelete = async (id: string, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Are you sure you want to disconnect repository "${name}"? This removes the Project Atlas link without touching files on disk.`)) return;

    try {
      const res = await api.deleteRepository(id);
      if (res.success) {
        if (selectedRepoId === id) {
          setSelectedRepoId(null);
          setSelectedRepoDetail(null);
        }
        await loadData();
      }
    } catch (err) {
      console.error('Failed to delete repository:', err);
    }
  };

  // Link task
  const handleLinkTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId || !selectedTaskToLink) return;

    setIsLinkingTask(true);
    try {
      const res = await api.linkTaskToRepository(selectedRepoId, selectedTaskToLink, taskBranchName || undefined);
      if (res.success) {
        setSelectedTaskToLink('');
        setTaskBranchName('');
        await openRepositoryDetails(selectedRepoId);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to link task:', err);
    } finally {
      setIsLinkingTask(false);
    }
  };

  // Unlink task
  const handleUnlinkTask = async (taskId: string) => {
    if (!selectedRepoId) return;
    try {
      const res = await api.unlinkTaskFromRepository(selectedRepoId, taskId);
      if (res.success) {
        await openRepositoryDetails(selectedRepoId);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to unlink task:', err);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(label);
    setTimeout(() => setCopiedCmd(null), 2200);
  };

  // Filtered and sorted repositories
  const filteredRepositories = useMemo(() => {
    return repositories
      .filter((repo) => {
        const matchesSearch =
          repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          repo.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (repo.localPath && repo.localPath.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesProject =
          selectedProjectFilter === 'ALL' || repo.projectId === selectedProjectFilter;

        const matchesStatus =
          selectedStatusFilter === 'ALL' ||
          (selectedStatusFilter === 'CONNECTED' && repo.status === 'CONNECTED') ||
          (selectedStatusFilter === 'LOCAL' && repo.isLocalReachable) ||
          (selectedStatusFilter === 'HAS_CHANGES' && (repo.uncommittedChangesCount || 0) > 0) ||
          (selectedStatusFilter === 'CLEAN' && repo.isClean);

        return matchesSearch && matchesProject && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'tasks') return (b._count?.tasks || 0) - (a._count?.tasks || 0);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [repositories, searchQuery, selectedProjectFilter, selectedStatusFilter, sortBy]);

  // Aggregate stats
  const totalRepos = repositories.length;
  const localReachableCount = repositories.filter((r) => r.isLocalReachable).length;
  const totalTasksLinked = repositories.reduce((acc, r) => acc + (r._count?.tasks || 0), 0);
  const cleanTreesCount = repositories.filter((r) => r.isClean).length;

  return (
    <AppShell headerTitle="Repositories & Codebases" headerSubtitle="Connect real Git repositories to Project Atlas tasks, code diffs, and verification suites.">
      <div className="flex-1 flex flex-col h-full bg-[#080808] text-neutral-200 overflow-y-auto select-none p-6 md:p-8 space-y-6">
        
        {/* Top Header & Metrics Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1F1F1F] pb-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <FolderGit2 className="w-5 h-5 text-white" />
              <h1 className="text-xl font-bold tracking-tight text-white">Repositories & Codebases</h1>
              <Badge variant="active">{totalRepos} Total</Badge>
            </div>
            <p className="text-xs text-neutral-400">
              Sovereign cryptographic Git link — associate tasks with real branches, live commits, and working tree evidence.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            {gitHubStatus?.connected ? (
              <div className="flex items-center space-x-2 bg-[#121212] border border-[#282828] rounded-lg px-2.5 py-1.5 text-xs">
                {gitHubStatus.avatarUrl ? (
                  <img src={gitHubStatus.avatarUrl} alt="" className="w-4 h-4 rounded-full border border-neutral-700" />
                ) : (
                  <GithubIcon className="w-3.5 h-3.5 text-white" />
                )}
                <span className="text-white font-mono text-[11px] font-medium">@{gitHubStatus.accountName}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Connected to GitHub API"></span>
                <button
                  onClick={handleDisconnectGitHub}
                  title="Disconnect GitHub account"
                  className="text-neutral-500 hover:text-rose-400 ml-1 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setErrorMessage(null);
                  setConnectTab('github');
                  setIsConnectModalOpen(true);
                }}
                className="text-xs bg-[#101010] border-[#2A2A2A] text-neutral-300 hover:text-white hover:bg-[#161616]"
              >
                <GithubIcon className="w-3.5 h-3.5 mr-1.5" />
                Link GitHub
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="text-xs bg-[#101010] border-[#2A2A2A] text-neutral-300 hover:text-white hover:bg-[#161616]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setErrorMessage(null);
                setConnectTab('cli');
                setIsConnectModalOpen(true);
              }}
              className="text-xs font-semibold bg-[#FAFAFA] text-[#111111] hover:bg-neutral-200"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Connect Repository
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#101010] border border-[#202020] rounded-lg p-3.5 space-y-1">
            <span className="text-[11px] font-mono uppercase text-neutral-500 tracking-wider">Registered Repos</span>
            <div className="text-lg font-bold text-white font-mono">{totalRepos}</div>
          </div>
          <div className="bg-[#101010] border border-[#202020] rounded-lg p-3.5 space-y-1">
            <span className="text-[11px] font-mono uppercase text-neutral-500 tracking-wider">Local Worktrees</span>
            <div className="text-lg font-bold text-neutral-200 font-mono">{localReachableCount}</div>
          </div>
          <div className="bg-[#101010] border border-[#202020] rounded-lg p-3.5 space-y-1">
            <span className="text-[11px] font-mono uppercase text-neutral-500 tracking-wider">Linked Tasks</span>
            <div className="text-lg font-bold text-neutral-200 font-mono">{totalTasksLinked}</div>
          </div>
          <div className="bg-[#101010] border border-[#202020] rounded-lg p-3.5 space-y-1">
            <span className="text-[11px] font-mono uppercase text-neutral-500 tracking-wider">Clean Trees</span>
            <div className="text-lg font-bold text-neutral-200 font-mono">{cleanTreesCount}</div>
          </div>
        </div>

        {/* CLI Quick Terminal Banner */}
        <div className="bg-[#0D0D0D] border border-[#222222] rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-neutral-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200 font-mono">
                Connect via Atlas CLI
              </h3>
              <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#1C1C1C] text-neutral-400">v1.0.0</span>
            </div>
            <p className="text-xs text-neutral-400">
              Run inside any local Git project to automatically bridge branch metadata and working tree status.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-[#050505] border border-[#262626] rounded-lg px-3.5 py-2 font-mono text-xs text-neutral-300 max-w-md w-full justify-between">
            <code className="truncate">atlas connect</code>
            <button
              onClick={() => copyToClipboard('atlas connect', 'cli-top')}
              className="text-neutral-400 hover:text-white flex items-center space-x-1.5 ml-2 shrink-0 transition-colors"
            >
              {copiedCmd === 'cli-top' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search, Filter, Sort Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex flex-1 items-center space-x-2.5 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories by name, slug, or path..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#101010] border border-[#222222] rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Project Filter */}
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="bg-[#101010] border border-[#222222] text-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-neutral-400 text-xs"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-[#101010] border border-[#222222] text-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-neutral-400 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONNECTED">Connected</option>
              <option value="LOCAL">Local Accessible</option>
              <option value="CLEAN">Clean Working Tree</option>
              <option value="HAS_CHANGES">Uncommitted Changes</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-[#101010] border border-[#222222] text-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-neutral-400 text-xs"
            >
              <option value="updated">Recently Updated</option>
              <option value="name">Name (A–Z)</option>
              <option value="tasks">Most Tasks</option>
            </select>
          </div>
        </div>

        {/* Repositories Main List or Empty State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <RefreshCw className="w-7 h-7 text-neutral-500 animate-spin" />
            <p className="text-xs text-neutral-500 font-mono">Querying registered repositories & Git status...</p>
          </div>
        ) : filteredRepositories.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[#222222] rounded-xl space-y-4 bg-[#0A0A0A]/60 p-8 max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center mx-auto text-neutral-400">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">
                {searchQuery ? 'No matching repositories found' : 'No repositories connected yet'}
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                {searchQuery
                  ? 'Try clearing your search query or adjusting active project filters.'
                  : 'Link a local or remote Git repository to Project Atlas to enable task verification, branch inspection, and automated commit tracking.'}
              </p>
            </div>

            {!searchQuery && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsConnectModalOpen(true);
                  }}
                  className="text-xs font-semibold bg-[#FAFAFA] text-[#111111] hover:bg-neutral-200"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Connect Repository
                </Button>
                <button
                  onClick={() => copyToClipboard('atlas connect', 'cli-empty')}
                  className="px-3 py-1.5 rounded bg-[#161616] border border-[#2A2A2A] text-xs text-neutral-300 hover:text-white font-mono flex items-center space-x-1.5"
                >
                  <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                  <span>atlas connect</span>
                  {copiedCmd === 'cli-empty' ? <Check className="w-3 h-3 text-emerald-400 ml-1" /> : <Copy className="w-3 h-3 ml-1" />}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepositories.map((repo) => {
              const isSyncing = syncingRepoId === repo.id;
              const hasChanges = (repo.uncommittedChangesCount || 0) > 0;

              return (
                <div
                  key={repo.id}
                  onClick={() => openRepositoryDetails(repo.id)}
                  className="bg-[#111111] border border-[#222222] hover:border-[#383838] rounded-xl p-5 space-y-4 transition-all duration-150 cursor-pointer flex flex-col justify-between group hover:shadow-lg hover:shadow-black/40"
                >
                  <div className="space-y-3">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <FolderGit2 className="w-4 h-4 text-neutral-300 group-hover:text-white transition-colors" />
                          <h4 className="text-sm font-bold text-white tracking-tight">{repo.name}</h4>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-500 block truncate max-w-[200px]">
                          {repo.slug}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={(e) => handleSyncRepository(repo.id, e)}
                          title="Sync live Git metadata"
                          disabled={isSyncing}
                          className="p-1.5 rounded text-neutral-500 hover:text-white hover:bg-[#1C1C1C] transition-colors"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(repo.id, repo.name, e)}
                          title="Disconnect repository"
                          className="p-1.5 rounded text-neutral-500 hover:text-rose-400 hover:bg-[#1C1C1C] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {repo.description && (
                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {repo.description}
                      </p>
                    )}

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono rounded bg-[#181818] border border-[#2A2A2A] text-neutral-300">
                        <GitBranch className="w-3 h-3 mr-1 text-neutral-400" />
                        {repo.liveBranch || repo.defaultBranch}
                      </span>

                      {repo.isLocalReachable ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
                          Local Tree
                        </span>
                      ) : repo.gitUrl ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#181818] border border-[#2A2A2A] text-neutral-400">
                          Remote
                        </span>
                      ) : null}

                      {hasChanges ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-amber-950/40 border border-amber-800/40 text-amber-300">
                          {repo.uncommittedChangesCount} modified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#151515] text-neutral-500 border border-[#222222]">
                          Clean
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer details */}
                  <div className="space-y-2 text-xs text-neutral-400 pt-3 border-t border-[#1C1C1C]">
                    {repo.project && (
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 text-[11px]">Linked Project:</span>
                        <span className="text-neutral-300 font-medium truncate max-w-[160px] flex items-center space-x-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: repo.project.color || '#FAFAFA' }}
                          />
                          <span>{repo.project.name}</span>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 text-[11px]">Linked Tasks:</span>
                      <span className="font-mono text-neutral-300 text-[11px]">
                        {repo._count?.tasks || 0} tasks
                      </span>
                    </div>

                    {repo.liveCommit && (
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-neutral-500">Latest Commit:</span>
                        <span className="text-neutral-300 font-mono">
                          {repo.liveCommit.shortHash}
                        </span>
                      </div>
                    )}

                    {repo.localPath && (
                      <div className="pt-1">
                        <span className="text-[10px] text-neutral-500 font-mono block truncate bg-[#0B0B0B] px-2 py-1 rounded border border-[#1A1A1A]">
                          {repo.localPath}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Dedicated Repository Details Slide-over / Modal ─── */}
        {selectedRepoId && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
            <div className="w-full max-w-4xl max-h-[90vh] bg-[#111111] border border-[#262626] rounded-xl flex flex-col shadow-2xl overflow-hidden">
              
              {/* Details Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-[#141414]">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-[#1F1F1F] border border-[#333333] flex items-center justify-center text-white">
                    <FolderGit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-bold text-white tracking-tight">
                        {selectedRepoDetail?.name || 'Repository Details'}
                      </h2>
                      {selectedRepoDetail?.isLocalReachable && (
                        <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                          ONLINE WORKTREE
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-neutral-400 font-mono">
                      {selectedRepoDetail?.slug}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncRepository(selectedRepoId)}
                    disabled={syncingRepoId === selectedRepoId}
                    className="text-xs bg-[#161616] border-[#2A2A2A] text-neutral-200"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncingRepoId === selectedRepoId ? 'animate-spin' : ''}`} />
                    Sync
                  </Button>
                  <button
                    onClick={() => {
                      setSelectedRepoId(null);
                      setSelectedRepoDetail(null);
                    }}
                    className="text-neutral-500 hover:text-white p-1 rounded hover:bg-[#1F1F1F] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center space-x-1 px-6 pt-3 border-b border-[#202020] bg-[#121212] text-xs font-mono">
                {(
                  [
                    { id: 'overview', label: 'Overview', icon: Layers },
                    { id: 'branches', label: `Branches (${branches.length})`, icon: GitBranch },
                    { id: 'commits', label: `Commits (${commits.length})`, icon: GitCommit },
                    { id: 'changes', label: `Changes (${treeStatus?.files?.length || 0})`, icon: FileCode },
                    { id: 'tasks', label: `Linked Tasks (${selectedRepoDetail?.tasks?.length || 0})`, icon: CheckSquare },
                    ...(selectedRepoDetail?.gitUrl?.includes('github.com') || gitHubActivity
                      ? [{ id: 'github' as const, label: `GitHub PRs (${gitHubActivity?.pullRequests?.length ?? 0})`, icon: GithubIcon }]
                      : []),
                  ]
                ).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeDetailTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveDetailTab(tab.id as any)}
                      className={`flex items-center space-x-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
                        isActive
                          ? 'border-white text-white font-semibold'
                          : 'border-transparent text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {detailLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-2">
                    <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
                    <span className="text-xs text-neutral-500 font-mono">Reading Git metadata...</span>
                  </div>
                ) : activeDetailTab === 'overview' ? (
                  <div className="space-y-6">
                    {/* Top Overview Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-[#151515] border border-[#262626] rounded-lg p-4 space-y-1">
                        <span className="text-[11px] font-mono uppercase text-neutral-500">Default Branch</span>
                        <div className="text-sm font-mono text-white font-semibold flex items-center space-x-1.5">
                          <GitBranch className="w-4 h-4 text-neutral-400" />
                          <span>{selectedRepoDetail?.defaultBranch}</span>
                        </div>
                      </div>
                      <div className="bg-[#151515] border border-[#262626] rounded-lg p-4 space-y-1">
                        <span className="text-[11px] font-mono uppercase text-neutral-500">Connection Status</span>
                        <div className="text-sm font-mono text-emerald-400 font-semibold flex items-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{selectedRepoDetail?.status || 'CONNECTED'}</span>
                        </div>
                      </div>
                      <div className="bg-[#151515] border border-[#262626] rounded-lg p-4 space-y-1">
                        <span className="text-[11px] font-mono uppercase text-neutral-500">Last Synchronized</span>
                        <div className="text-xs font-mono text-neutral-300">
                          {selectedRepoDetail?.lastSyncedAt
                            ? new Date(selectedRepoDetail.lastSyncedAt).toLocaleString()
                            : 'On registration'}
                        </div>
                      </div>
                    </div>

                    {/* Path & Remote info */}
                    <div className="bg-[#141414] border border-[#242424] rounded-lg p-4 space-y-3">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                        Filesystem & Origin Configuration
                      </h4>
                      <div className="space-y-2 text-xs">
                        {selectedRepoDetail?.localPath && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded bg-[#0A0A0A] border border-[#1F1F1F]">
                            <span className="text-neutral-500 font-mono">Local Worktree:</span>
                            <span className="font-mono text-neutral-200 select-all truncate">
                              {selectedRepoDetail.localPath}
                            </span>
                          </div>
                        )}
                        {selectedRepoDetail?.gitUrl && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded bg-[#0A0A0A] border border-[#1F1F1F]">
                            <span className="text-neutral-500 font-mono">Git Remote Origin:</span>
                            <span className="font-mono text-neutral-200 select-all truncate">
                              {selectedRepoDetail.gitUrl}
                            </span>
                          </div>
                        )}
                        {selectedRepoDetail?.project && (
                          <div className="flex items-center justify-between p-2 rounded bg-[#0A0A0A] border border-[#1F1F1F]">
                            <span className="text-neutral-500 font-mono">Associated Project:</span>
                            <span className="text-neutral-200 font-medium">
                              {selectedRepoDetail.project.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick CLI command */}
                    <div className="bg-[#101010] border border-[#262626] rounded-lg p-4 space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                        Terminal Synchronization
                      </h4>
                      <p className="text-xs text-neutral-400">
                        To claim tasks or verify tests against this repository from your terminal:
                      </p>
                      <div className="flex items-center justify-between bg-[#080808] border border-[#202020] rounded p-2.5 font-mono text-xs text-neutral-300">
                        <code>atlas tasks --repo {selectedRepoDetail?.name}</code>
                        <button
                          onClick={() => copyToClipboard(`atlas tasks --repo ${selectedRepoDetail?.name}`, 'cli-detail')}
                          className="text-neutral-500 hover:text-white flex items-center space-x-1"
                        >
                          {copiedCmd === 'cli-detail' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : activeDetailTab === 'branches' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                      <span className="text-xs font-mono uppercase text-neutral-400">
                        Active Local & Remote Branches
                      </span>
                      <span className="text-xs text-neutral-500 font-mono">{branches.length} branch(es)</span>
                    </div>

                    {branches.length === 0 ? (
                      <div className="text-center py-12 text-xs text-neutral-500 font-mono">
                        No branches discovered in this repository.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {branches.map((b) => (
                          <div
                            key={b.name}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border text-xs font-mono ${
                              b.isCurrent
                                ? 'bg-[#181818] border-neutral-600 text-white'
                                : 'bg-[#121212] border-[#222222] text-neutral-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <GitBranch className={`w-4 h-4 ${b.isCurrent ? 'text-white' : 'text-neutral-500'}`} />
                              <span className="font-semibold">{b.name}</span>
                              {b.isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-white text-black font-bold">
                                  CURRENT HEAD
                                </span>
                              )}
                              {b.isRemote && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#222222] text-neutral-400">
                                  REMOTE
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-3 mt-2 sm:mt-0 text-[11px] text-neutral-500">
                              <span className="truncate max-w-[200px] text-neutral-400">{b.subject}</span>
                              <span className="text-neutral-400 font-mono">{b.commitHash}</span>
                              <button
                                onClick={() => copyToClipboard(`git checkout ${b.name.replace(/^origin\//, '')}`, b.name)}
                                title="Copy checkout command"
                                className="text-neutral-500 hover:text-white p-1"
                              >
                                {copiedCmd === b.name ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeDetailTab === 'commits' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                      <span className="text-xs font-mono uppercase text-neutral-400">Commit History (Recent 30)</span>
                      <span className="text-xs text-neutral-500 font-mono">{commits.length} commits</span>
                    </div>

                    {commits.length === 0 ? (
                      <div className="text-center py-12 text-xs text-neutral-500 font-mono">
                        No commit history found or local repository offline.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {commits.map((c) => (
                          <div
                            key={c.hash}
                            className="bg-[#121212] border border-[#222222] rounded-lg p-3 space-y-1.5 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <p className="font-medium text-white tracking-tight">{c.message}</p>
                                <div className="flex items-center space-x-2 text-[11px] text-neutral-500 font-mono">
                                  <span>{c.authorName}</span>
                                  <span>•</span>
                                  <span>{c.relativeDate || new Date(c.date).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 shrink-0">
                                {c.matchedTask && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/40 border border-blue-800/40 text-blue-300">
                                    Linked: {c.matchedTask.title}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded bg-[#1C1C1C] border border-[#2D2D2D] font-mono text-[11px] text-neutral-300">
                                  {c.shortHash}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeDetailTab === 'changes' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono uppercase text-neutral-400">
                          Working Tree Status ({treeStatus?.files?.length || 0} modified)
                        </span>
                        {treeStatus?.isClean && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                            CLEAN
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-neutral-500">
                        Branch: {treeStatus?.branch || 'HEAD'}
                      </div>
                    </div>

                    {(!treeStatus || !treeStatus.files || treeStatus.files.length === 0) ? (
                      <div className="text-center py-12 text-xs text-neutral-500 font-mono bg-[#0D0D0D] border border-dashed border-[#222222] rounded-lg">
                        Working tree clean. No uncommitted modifications.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* File list */}
                        <div className="space-y-1.5 max-h-80 overflow-y-auto">
                          {treeStatus.files?.map((file: any) => (
                            <button
                              key={file.path}
                              onClick={() => inspectFileDiff(file.path)}
                              className={`w-full text-left p-2 rounded text-xs font-mono flex items-center justify-between transition-colors ${
                                selectedDiffFile === file.path
                                  ? 'bg-[#222222] text-white border border-neutral-600'
                                  : 'bg-[#121212] text-neutral-300 border border-[#202020] hover:bg-[#1A1A1A]'
                              }`}
                            >
                              <span className="truncate pr-2">{file.path}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  (typeof file === "object" ? file.status : "") === 'M'
                                    ? 'text-amber-400 bg-amber-950/40'
                                    : file.status === 'A' || file.status === '?'
                                    ? 'text-emerald-400 bg-emerald-950/40'
                                    : 'text-rose-400 bg-rose-950/40'
                                }`}
                              >
                                {file.status}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Diff Preview */}
                        <div className="md:col-span-2 bg-[#090909] border border-[#222222] rounded-lg p-3 flex flex-col min-h-[220px]">
                          <div className="flex items-center justify-between pb-2 border-b border-[#1C1C1C] text-[11px] font-mono text-neutral-400">
                            <span>{selectedDiffFile ? `Diff: ${selectedDiffFile}` : 'Select a file to inspect diff'}</span>
                          </div>

                          <div className="flex-1 overflow-auto mt-2 font-mono text-xs max-h-64">
                            {diffLoading ? (
                              <div className="flex items-center justify-center h-full py-8 text-neutral-500 text-xs">
                                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                Loading unified diff...
                              </div>
                            ) : diffContent ? (
                              <pre className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
                                {diffContent.split('\n').map((line, idx) => {
                                  let color = 'text-neutral-400';
                                  if (line.startsWith('+') && !line.startsWith('+++')) color = 'text-emerald-400 bg-emerald-950/20';
                                  if (line.startsWith('-') && !line.startsWith('---')) color = 'text-rose-400 bg-rose-950/20';
                                  if (line.startsWith('@@')) color = 'text-blue-400 bg-blue-950/20';
                                  return (
                                    <div key={idx} className={`${color} px-1 rounded-sm`}>
                                      {line}
                                    </div>
                                  );
                                })}
                              </pre>
                            ) : (
                              <div className="text-center py-12 text-neutral-600 text-xs font-mono">
                                Click any changed file on the left to preview unified Git diff.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Tasks tab */
                  <div className="space-y-6">
                    {/* Link task form */}
                    <form onSubmit={handleLinkTask} className="bg-[#141414] border border-[#242424] rounded-lg p-4 space-y-3">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-300 font-semibold">
                        Link Task to this Repository
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={selectedTaskToLink}
                          onChange={(e) => setSelectedTaskToLink(e.target.value)}
                          required
                          className="sm:col-span-2 px-3 py-1.5 bg-[#0C0C0C] border border-[#262626] rounded text-xs text-white focus:outline-none focus:border-neutral-400"
                        >
                          <option value="">Select a workspace task to link...</option>
                          {tasks.map((t) => (
                            <option key={t.id} value={t.id}>
                              [{t.priority}] {t.title} ({t.status})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={taskBranchName}
                          onChange={(e) => setTaskBranchName(e.target.value)}
                          placeholder="Feature branch (optional)"
                          className="px-3 py-1.5 bg-[#0C0C0C] border border-[#262626] rounded text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-400"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isLinkingTask || !selectedTaskToLink}
                          className="text-xs bg-white text-black font-semibold hover:bg-neutral-200"
                        >
                          <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
                          {isLinkingTask ? 'Linking...' : 'Link Task'}
                        </Button>
                      </div>
                    </form>

                    {/* Associated Tasks List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                        Currently Linked Tasks ({selectedRepoDetail?.tasks?.length || 0})
                      </h4>

                      {(!selectedRepoDetail?.tasks || selectedRepoDetail.tasks.length === 0) ? (
                        <div className="text-center py-8 text-xs text-neutral-500 font-mono bg-[#0D0D0D] border border-dashed border-[#202020] rounded-lg">
                          No tasks associated with this codebase yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedRepoDetail.tasks?.map((task: any) => (
                            <div
                              key={task.id}
                              className="bg-[#121212] border border-[#222222] rounded-lg p-3 flex items-center justify-between text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-white">{task.title}</span>
                                  {task.isVerified && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                                      VERIFIED
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 text-[11px] text-neutral-500 font-mono">
                                  <span>Status: {task.status}</span>
                                  {task.branchName && (
                                    <>
                                      <span>•</span>
                                      <span className="text-neutral-400">Branch: {task.branchName}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => handleUnlinkTask(task.id)}
                                title="Unlink task from repository"
                                className="text-neutral-500 hover:text-rose-400 p-1.5 transition-colors"
                              >
                                <Unlink className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 6: GitHub Remote PRs & Activity */}
                {activeDetailTab === 'github' && (
                  <div className="space-y-6">
                    {gitHubActivityLoading ? (
                      <div className="text-center py-12 space-y-2">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-neutral-400" />
                        <span className="text-xs text-neutral-500 font-mono">Querying GitHub API...</span>
                      </div>
                    ) : !gitHubActivity ? (
                      <div className="text-center py-12 space-y-3 bg-[#0D0D0D] border border-dashed border-[#202020] rounded-lg p-6">
                        <GithubIcon className="w-8 h-8 mx-auto text-neutral-500" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-white">No GitHub Activity Available</h4>
                          <p className="text-xs text-neutral-400 max-w-md mx-auto">
                            Connect your GitHub account or Personal Access Token to inspect pull requests and live remote commits.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setConnectTab('github');
                            setIsConnectModalOpen(true);
                          }}
                          className="text-xs bg-[#161616] border-[#2A2A2A] text-neutral-200"
                        >
                          <Key className="w-3.5 h-3.5 mr-1.5" />
                          Configure GitHub Token
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Pull Requests Section */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold flex items-center space-x-1.5">
                              <GitPullRequest className="w-4 h-4 text-neutral-300" />
                              <span>GitHub Pull Requests ({gitHubActivity.pullRequests?.length || 0})</span>
                            </h4>
                            <a
                              href={`https://github.com/${gitHubActivity.owner}/${gitHubActivity.repo}/pulls`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-neutral-400 hover:text-white flex items-center space-x-1"
                            >
                              <span>View on GitHub</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          {(!gitHubActivity.pullRequests || gitHubActivity.pullRequests.length === 0) ? (
                            <div className="text-center py-6 text-xs text-neutral-500 font-mono bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg">
                              No open or recent pull requests found.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {gitHubActivity.pullRequests?.map((pr: any) => (
                                <a
                                  key={pr.number}
                                  href={pr.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block bg-[#121212] hover:bg-[#161616] border border-[#222222] hover:border-[#333333] rounded-lg p-3.5 space-y-2 transition-all group"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                          pr.state === 'open'
                                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                            : 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                                        }`}>
                                          {pr.state.toUpperCase()}
                                        </span>
                                        <span className="text-xs font-semibold text-white group-hover:text-neutral-100">
                                          {pr.title}
                                        </span>
                                        <span className="text-[11px] font-mono text-neutral-500">#{pr.number}</span>
                                      </div>
                                      <div className="flex items-center space-x-2 text-[11px] text-neutral-400 font-mono">
                                        <span>by @{(pr as any).author || pr.user}</span>
                                        <span>•</span>
                                        <span>{(pr as any).sourceBranch || 'head'} → {(pr as any).targetBranch || 'main'}</span>
                                        <span>•</span>
                                        <span>{new Date((pr as any).updatedAt || Date.now()).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white shrink-0 mt-1 transition-colors" />
                                  </div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Recent Remote Commits Section */}
                        <div className="space-y-3 pt-2 border-t border-[#1F1F1F]">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold flex items-center space-x-1.5">
                              <GitCommit className="w-4 h-4 text-neutral-300" />
                              <span>Remote GitHub Commits ({gitHubActivity.commits?.length || 0})</span>
                            </h4>
                            <a
                              href={`https://github.com/${gitHubActivity.owner}/${gitHubActivity.repo}/commits`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-neutral-400 hover:text-white flex items-center space-x-1"
                            >
                              <span>Commit Log</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          <div className="space-y-1.5 font-mono text-xs">
                            {gitHubActivity.commits?.map((c: any) => (
                              <div
                                key={c.sha}
                                className="bg-[#121212] border border-[#202020] rounded p-2.5 flex items-center justify-between gap-3"
                              >
                                <div className="space-y-0.5 truncate">
                                  <div className="text-neutral-200 truncate">{c.message}</div>
                                  <div className="text-[10px] text-neutral-500">
                                    {(c as any).authorName || c.author} • {new Date(c.date).toLocaleDateString()}
                                  </div>
                                </div>
                                <a
                                  href={(c as any).url || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-0.5 bg-[#181818] border border-[#2A2A2A] rounded text-[10px] text-neutral-300 hover:text-white shrink-0"
                                >
                                  {(c as any).shortSha || c.sha?.slice(0, 7)}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Connect Repository Wizard Modal ─── */}
        {isConnectModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-[#111111] border border-[#282828] rounded-xl p-6 space-y-5 shadow-2xl">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <div className="flex items-center space-x-2">
                  <FolderGit2 className="w-5 h-5 text-white" />
                  <h3 className="text-sm font-bold text-white tracking-tight">Connect Repository</h3>
                </div>
                <button
                  onClick={() => setIsConnectModalOpen(false)}
                  className="text-neutral-500 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Method Switcher Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-[#090909] border border-[#202020] rounded-lg text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setConnectTab('cli')}
                  className={`py-1.5 rounded transition-colors font-medium ${
                    connectTab === 'cli'
                      ? 'bg-[#202020] text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Atlas CLI
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab('local')}
                  className={`py-1.5 rounded transition-colors font-medium ${
                    connectTab === 'local'
                      ? 'bg-[#202020] text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Local Path
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab('remote')}
                  className={`py-1.5 rounded transition-colors font-medium ${
                    connectTab === 'remote'
                      ? 'bg-[#202020] text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Remote URL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConnectTab('github');
                    if (gitHubStatus?.connected && gitHubRepos.length === 0) {
                      loadGitHubRepos();
                    }
                  }}
                  className={`py-1.5 rounded transition-colors font-medium flex items-center justify-center space-x-1 ${
                    connectTab === 'github'
                      ? 'bg-[#202020] text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <GithubIcon className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs font-mono">
                  {errorMessage}
                </div>
              )}

              {/* Tab 1: Atlas CLI (Recommended) */}
              {connectTab === 'cli' && (
                <div className="space-y-4 text-xs">
                  <p className="text-neutral-400 leading-relaxed">
                    Connect your local Git workspace in seconds directly through your terminal using the Atlas CLI:
                  </p>

                  <div className="space-y-2">
                    <span className="text-[11px] font-mono uppercase text-neutral-400 block font-semibold">
                      Step 1: Open repository directory
                    </span>
                    <div className="bg-[#080808] border border-[#202020] rounded p-2.5 font-mono text-neutral-300">
                      cd /path/to/your/git-repository
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-mono uppercase text-neutral-400 block font-semibold">
                      Step 2: Connect repository
                    </span>
                    <div className="flex items-center justify-between bg-[#080808] border border-[#202020] rounded p-2.5 font-mono text-neutral-300">
                      <code>atlas connect</code>
                      <button
                        onClick={() => copyToClipboard('atlas connect', 'cli-modal')}
                        className="text-neutral-400 hover:text-white flex items-center space-x-1"
                      >
                        {copiedCmd === 'cli-modal' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCmd === 'cli-modal' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-500 font-mono leading-relaxed pt-1">
                    * If you haven't authenticated the CLI yet, run <code className="text-neutral-300">atlas login --token &lt;token&gt;</code> using your developer token from settings.
                  </p>

                  <div className="flex justify-end pt-3 border-t border-[#202020]">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsConnectModalOpen(false)}
                      className="text-xs bg-white text-black font-semibold"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 2: Local Path Form */}
              {connectTab === 'local' && (
                <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                      Local Working Tree Path *
                    </label>
                    <input
                      type="text"
                      required
                      value={localPath}
                      onChange={(e) => {
                        setLocalPath(e.target.value);
                        if (!repoName) {
                          const parts = e.target.value.replace(/\\/g, '/').split('/').filter(Boolean);
                          if (parts.length > 0) setRepoName(parts[parts.length - 1]);
                        }
                      }}
                      placeholder="e.g. c:/Users/chera/Downloads/AppFlowy-main"
                      className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                      Repository Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="e.g. AppFlowy-main"
                      className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        Default Branch
                      </label>
                      <input
                        type="text"
                        value={defaultBranch}
                        onChange={(e) => setDefaultBranch(e.target.value)}
                        placeholder="main"
                        className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        Linked Project
                      </label>
                      <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white focus:outline-none focus:border-neutral-400 text-xs"
                      >
                        <option value="">None (Independent)</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Short notes about this codebase"
                      className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#202020]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConnectModalOpen(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmitting}
                      className="text-xs font-semibold bg-white text-black hover:bg-neutral-200"
                    >
                      {isSubmitting ? 'Registering...' : 'Link Local Worktree'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Tab 3: Remote URL Form */}
              {connectTab === 'remote' && (
                <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                      Git Remote URL *
                    </label>
                    <input
                      type="text"
                      required
                      value={gitUrl}
                      onChange={(e) => {
                        setGitUrl(e.target.value);
                        if (!repoName) {
                          const match = e.target.value.match(/\/([^\/]+?)(\.git)?$/);
                          if (match && match[1]) setRepoName(match[1]);
                        }
                      }}
                      placeholder="e.g. https://github.com/my-org/my-project.git"
                      className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white font-mono text-[11px] placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                      Repository Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="e.g. my-project"
                      className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        Default Branch
                      </label>
                      <input
                        type="text"
                        value={defaultBranch}
                        onChange={(e) => setDefaultBranch(e.target.value)}
                        placeholder="main"
                        className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                        Linked Project
                      </label>
                      <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white focus:outline-none focus:border-neutral-400 text-xs"
                      >
                        <option value="">None (Independent)</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Short notes about this codebase"
                      className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#202020]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConnectModalOpen(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmitting}
                      className="text-xs font-semibold bg-white text-black hover:bg-neutral-200"
                    >
                      {isSubmitting ? 'Registering...' : 'Register Remote Repository'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Tab 4: GitHub Integration & Import */}
              {connectTab === 'github' && (
                <div className="space-y-4 text-xs">
                  {gitHubError && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs font-mono">
                      {gitHubError}
                    </div>
                  )}

                  {gitHubStatus?.connected ? (
                    <div className="space-y-4">
                      {/* Connected Account Banner */}
                      <div className="bg-[#141414] border border-[#282828] rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {gitHubStatus.avatarUrl ? (
                            <img
                              src={gitHubStatus.avatarUrl}
                              alt=""
                              className="w-9 h-9 rounded-full border border-neutral-700"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#1F1F1F] border border-neutral-700 flex items-center justify-center">
                              <GithubIcon className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white text-sm">@{gitHubStatus.accountName}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                                ACTIVE
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-400 font-mono block">
                              Scopes: {gitHubStatus.scopes || 'repo,read:user'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={loadGitHubRepos}
                            disabled={gitHubLoading}
                            className="text-xs bg-[#1C1C1C] border-[#2E2E2E] text-neutral-200"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${gitHubLoading ? 'animate-spin' : ''}`} />
                            Refresh
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={handleDisconnectGitHub}
                            className="text-xs"
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>

                      {/* Repositories Search & Import List */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono uppercase text-neutral-400 font-semibold tracking-wider">
                            Accessible GitHub Repositories ({gitHubRepos.length})
                          </span>
                          <div className="w-48">
                            <input
                              type="text"
                              value={gitHubSearchQuery}
                              onChange={(e) => setGitHubSearchQuery(e.target.value)}
                              placeholder="Search remote repos..."
                              className="w-full px-2.5 py-1 bg-[#161616] border border-[#282828] rounded text-[11px] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                            />
                          </div>
                        </div>

                        {gitHubLoading ? (
                          <div className="text-center py-10 space-y-2 bg-[#0E0E0E] border border-[#202020] rounded-lg">
                            <RefreshCw className="w-4 h-4 animate-spin mx-auto text-neutral-400" />
                            <span className="text-xs text-neutral-500 font-mono">Fetching repositories from GitHub...</span>
                          </div>
                        ) : gitHubRepos.length === 0 ? (
                          <div className="text-center py-8 space-y-2 bg-[#0E0E0E] border border-[#202020] rounded-lg p-4">
                            <p className="text-neutral-400">No repositories found or token lacks repository read access.</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={loadGitHubRepos}
                              className="text-xs bg-[#1A1A1A] border-[#303030] text-white"
                            >
                              Retry Fetch
                            </Button>
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {gitHubRepos
                              .filter((r) =>
                                gitHubSearchQuery
                                  ? r.fullName.toLowerCase().includes(gitHubSearchQuery.toLowerCase())
                                  : true
                              )
                              .map((repo) => {
                                const isAlreadyConnected = repositories.some(
                                  (existing) =>
                                    existing.gitUrl === repo.htmlUrl ||
                                    existing.name.toLowerCase() === repo.name.toLowerCase()
                                );
                                const isImporting = importingRepoName === repo.fullName;

                                return (
                                  <div
                                    key={repo.id}
                                    className="bg-[#141414] border border-[#222222] hover:border-[#333333] rounded-lg p-3 flex items-center justify-between gap-3 transition-colors"
                                  >
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="flex items-center space-x-2">
                                        {repo.isPrivate ? (
                                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        ) : (
                                          <Globe className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                        )}
                                        <span className="font-semibold text-white truncate text-xs">
                                          {repo.fullName}
                                        </span>
                                        <span className="text-[10px] font-mono text-neutral-500 px-1.5 py-0.2 rounded bg-[#1C1C1C]">
                                          {repo.defaultBranch}
                                        </span>
                                      </div>
                                      {repo.description && (
                                        <p className="text-[11px] text-neutral-400 truncate">{repo.description}</p>
                                      )}
                                    </div>

                                    <div className="shrink-0">
                                      {isAlreadyConnected ? (
                                        <span className="px-2 py-1 text-[10px] font-mono rounded bg-[#1C1C1C] text-neutral-400 border border-[#2A2A2A]">
                                          Imported
                                        </span>
                                      ) : (
                                        <Button
                                          size="sm"
                                          disabled={isImporting}
                                          onClick={() => handleImportGitHubRepo(repo)}
                                          className="text-xs font-semibold bg-white text-black hover:bg-neutral-200 h-7 px-2.5"
                                        >
                                          {isImporting ? 'Importing...' : 'Import'}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end pt-3 border-t border-[#202020]">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setIsConnectModalOpen(false)}
                          className="text-xs bg-white text-black font-semibold"
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Unauthenticated State — Token Input Form */
                    <form onSubmit={handleConnectGitHub} className="space-y-4">
                      <div className="space-y-2 bg-[#141414] border border-[#262626] rounded-xl p-4">
                        <div className="flex items-center space-x-2">
                          <GithubIcon className="w-4 h-4 text-white" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                            Link GitHub Account
                          </h4>
                        </div>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          Enter a GitHub Personal Access Token (classic or fine-grained) to browse your remote repositories, import projects in 1-click, and view live pull requests.
                        </p>
                        <div className="pt-1">
                          <a
                            href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=Project%20Atlas%20Collaboration"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1.5 text-neutral-300 hover:text-white underline text-xs font-mono"
                          >
                            <span>Generate token on GitHub (with repo & read:user scope)</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">
                          GitHub Access Token *
                        </label>
                        <input
                          type="password"
                          required
                          value={gitHubToken}
                          onChange={(e) => setGitHubToken(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_..."
                          className="w-full px-3 py-2 bg-[#181818] border border-[#2c2c2c] rounded-lg text-white font-mono text-xs placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
                        />
                      </div>

                      <div className="p-3 bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg text-[11px] text-neutral-400 font-mono space-y-1">
                        <div className="flex items-center space-x-1.5 text-neutral-300 font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Enterprise Cryptographic Security</span>
                        </div>
                        <p className="text-neutral-500 leading-relaxed">
                          Your token is encrypted using AES-256-GCM before storage. Project Atlas never exposes raw tokens to client bundles or log outputs.
                        </p>
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#202020]">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsConnectModalOpen(false)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSubmitting}
                          className="text-xs font-semibold bg-white text-black hover:bg-neutral-200"
                        >
                          {isSubmitting ? 'Verifying with GitHub...' : 'Connect GitHub Account'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
