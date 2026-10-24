'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/app-shell';
import {
  api,
  CodeReviewItem,
  CodeReviewDetail,
  RepositoryItem,
  TaskItem,
  GitBranchItem,
} from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import {
  GitPullRequest,
  GitBranch,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquare,
  Send,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  FileCode,
  FolderGit2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  SlidersHorizontal,
  User,
  ArrowRight,
} from 'lucide-react';

export default function CodeReviewsPage() {
  const [reviews, setReviews] = useState<CodeReviewItem[]>([]);
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [repoFilter, setRepoFilter] = useState<string>('ALL');

  // Review Inspector Drawer
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedReviewDetail, setSelectedReviewDetail] = useState<CodeReviewDetail | null>(null);
  const [reviewDiff, setReviewDiff] = useState<string | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Code Review Modal
  const [isNewReviewModalOpen, setIsNewReviewModalOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [availableBranches, setAvailableBranches] = useState<GitBranchItem[]>([]);
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewDescription, setReviewDescription] = useState('');
  const [linkedTaskId, setLinkedTaskId] = useState('');
  const [isCreatingReview, setIsCreatingReview] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [reviewRes, repoRes, taskRes] = await Promise.all([
        api.listCodeReviews(),
        api.listRepositories(),
        api.getTasks(),
      ]);

      if (reviewRes.success && reviewRes.data?.reviews) {
        setReviews(reviewRes.data.reviews);
      }
      if (repoRes.success && repoRes.data?.repositories) {
        setRepositories(repoRes.data.repositories);
        if (!selectedRepoId && repoRes.data.repositories.length > 0) {
          setSelectedRepoId(repoRes.data.repositories[0].id);
        }
      }
      if (taskRes.success && taskRes.data?.tasks) {
        setTasks(taskRes.data.tasks);
      }
    } catch (err) {
      console.error('Failed to load code reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When selected repo in new review modal changes, fetch its branches
  useEffect(() => {
    if (!selectedRepoId) return;
    const fetchBranches = async () => {
      try {
        const res = await api.getRepositoryBranches(selectedRepoId);
        if (res.success && res.data?.branches) {
          setAvailableBranches(res.data.branches);
          const nonMain = res.data.branches.find((b: any) => b.name !== 'main' && b.name !== 'master');
          setSourceBranch(nonMain ? nonMain.name : res.data.branches[0]?.name || 'main');
        }
      } catch {
        // Fallback
      }
    };
    fetchBranches();
  }, [selectedRepoId]);

  // Open Review Details
  const openReviewDetails = async (reviewId: string) => {
    setSelectedReviewId(reviewId);
    setIsDiffLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await api.getCodeReview(reviewId);
      if (res.success && res.data) {
        setSelectedReviewDetail(res.data.review);
        setReviewDiff(res.data.diff ?? null);
      }
    } catch (err) {
      console.error('Failed to open code review:', err);
    } finally {
      setIsDiffLoading(false);
    }
  };

  // Submit Review Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewId || !newCommentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await api.addCodeReviewComment(selectedReviewId, {
        content: newCommentText.trim(),
      });
      if (res.success) {
        setNewCommentText('');
        await openReviewDetails(selectedReviewId);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Submit Review Action (APPROVE, REQUEST_CHANGES, CLOSE)
  const handleReviewAction = async (action: 'APPROVE' | 'REQUEST_CHANGES' | 'CLOSE' | 'REOPEN', summary?: string) => {
    if (!selectedReviewId) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await api.submitCodeReviewAction(selectedReviewId, {
        action,
        summary: summary || undefined,
      });

      if (res.success) {
        setActionSuccess(`Code review ${action.toLowerCase().replace('_', ' ')}.`);
        await openReviewDetails(selectedReviewId);
        await loadData();
      } else {
        setActionError(res.error?.message || 'Failed to record review action');
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error');
    }
  };

  // Create Code Review
  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId || !reviewTitle.trim() || !sourceBranch.trim()) return;

    setIsCreatingReview(true);
    setCreateError(null);
    try {
      const res = await api.createCodeReview({
        repositoryId: selectedRepoId,
        title: reviewTitle.trim(),
        description: reviewDescription.trim() || undefined,
        sourceBranch: sourceBranch.trim(),
        targetBranch: targetBranch.trim() || 'main',
        taskId: linkedTaskId || undefined,
      });

      if (res.success && res.data?.review) {
        setIsNewReviewModalOpen(false);
        setReviewTitle('');
        setReviewDescription('');
        setLinkedTaskId('');
        await loadData();
        openReviewDetails(res.data.review.id);
      } else {
        setCreateError(res.error?.message || 'Failed to create code review');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Network error');
    } finally {
      setIsCreatingReview(false);
    }
  };

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.sourceBranch.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.repository.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const matchesRepo = repoFilter === 'ALL' || r.repositoryId === repoFilter;

      return matchesSearch && matchesStatus && matchesRepo;
    });
  }, [reviews, searchQuery, statusFilter, repoFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-800 bg-emerald-950/40 text-emerald-400 font-mono text-[10px]">
            <CheckCircle2 className="w-3 h-3" /> APPROVED
          </span>
        );
      case 'CHANGES_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-800 bg-amber-950/40 text-amber-400 font-mono text-[10px]">
            <AlertCircle className="w-3 h-3" /> CHANGES REQUESTED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-400 font-mono text-[10px]">
            CLOSED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-blue-900 bg-blue-950/40 text-blue-400 font-mono text-[10px]">
            <Clock className="w-3 h-3" /> REVIEW REQUESTED
          </span>
        );
    }
  };

  return (
    <AppShell headerTitle="CODE REVIEWS" headerSubtitle="Peer review workflows, diff inspection, and real-time approval gates">
      <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans text-zinc-100">

        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#111216] border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reviews by branch, title, or repo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#181920] border border-zinc-700/80 text-zinc-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="REVIEW_REQUESTED">Review Requested</option>
              <option value="APPROVED">Approved</option>
              <option value="CHANGES_REQUESTED">Changes Requested</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsNewReviewModalOpen(true)}
              className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Code Review
            </Button>
          </div>
        </div>

        {/* Reviews List */}
        <div className="bg-[#111216] border border-zinc-800/80 rounded-xl overflow-hidden shadow-lg">
          <div className="divide-y divide-zinc-800/60 font-sans">
            {filteredReviews.map((review) => (
              <div
                key={review.id}
                onClick={() => openReviewDetails(review.id)}
                className="p-4 hover:bg-zinc-800/40 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white hover:underline">
                      {review.title}
                    </span>
                    {getStatusBadge(review.status)}
                    <Badge variant="secondary" className="border-zinc-800 bg-zinc-900 text-zinc-400 text-[10px]">
                      {review.repository?.name || "Repository"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                    <span className="flex items-center gap-1 text-zinc-300">
                      <GitBranch className="w-3 h-3 text-zinc-500" />
                      {review.sourceBranch}
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <span className="text-zinc-500">{review.targetBranch}</span>
                    <span>•</span>
                    <span>Author: {review.author?.displayName || "Reviewer"}</span>
                    {review.task && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-300">Task: {review.task.title}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-zinc-400 self-end md:self-center font-mono">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{review._count?.comments ?? 0}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </div>
              </div>
            ))}

            {filteredReviews.length === 0 && (
              <div className="py-16 text-center text-zinc-500 space-y-2">
                <GitPullRequest className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="text-sm font-medium text-zinc-400">No Code Reviews Found</div>
                <div className="text-xs text-zinc-500">
                  Open a new review from a feature branch to initiate peer reviews.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* REVIEW INSPECTOR DRAWER */}
        {selectedReviewId && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
            <div className="w-full max-w-4xl bg-[#111216] border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-[#15161c]">
                <div className="flex items-center gap-3">
                  <GitPullRequest className="w-5 h-5 text-white" />
                  <div>
                    <h2 className="font-semibold text-base text-white">
                      {selectedReviewDetail?.title || 'Code Review Inspector'}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                      <span>{selectedReviewDetail?.sourceBranch}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-600" />
                      <span>{selectedReviewDetail?.targetBranch}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedReviewId(null);
                    setSelectedReviewDetail(null);
                  }}
                  className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action feedback */}
              {actionSuccess && (
                <div className="p-3 bg-zinc-900 border-b border-zinc-800 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {actionSuccess}
                </div>
              )}
              {actionError && (
                <div className="p-3 bg-red-950/40 border-b border-red-900 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {actionError}
                </div>
              )}

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Meta Overview */}
                <div className="bg-[#181920] border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-400 uppercase">Review Status</span>
                    {selectedReviewDetail && getStatusBadge(selectedReviewDetail.status)}
                  </div>
                  {selectedReviewDetail?.description && (
                    <div className="text-xs text-zinc-300 border-t border-zinc-800 pt-2">
                      {selectedReviewDetail.description}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handleReviewAction('APPROVE')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 h-8"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve Changes
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReviewAction('REQUEST_CHANGES')}
                      variant="outline"
                      className="border-amber-800 text-amber-400 hover:bg-amber-950/40 text-xs gap-1.5 h-8"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Request Changes
                    </Button>
                    {selectedReviewDetail?.status !== 'CLOSED' ? (
                      <Button
                        size="sm"
                        onClick={() => handleReviewAction('CLOSE')}
                        variant="ghost"
                        className="text-zinc-400 hover:text-white text-xs h-8"
                      >
                        Close Review
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleReviewAction('REOPEN')}
                        variant="ghost"
                        className="text-zinc-400 hover:text-white text-xs h-8"
                      >
                        Reopen Review
                      </Button>
                    )}
                  </div>
                </div>

                {/* Diff Viewer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                      Unified Git Diff Preview
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">Live Worktree Diff</span>
                  </div>

                  <div className="bg-[#0b0c10] border border-zinc-800 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-96">
                    {isDiffLoading ? (
                      <div className="text-zinc-500 py-6 text-center">Loading diff...</div>
                    ) : reviewDiff ? (
                      <pre className="whitespace-pre">
                        {reviewDiff.split('\n').map((line, idx) => {
                          let lineStyle = 'text-zinc-400';
                          if (line.startsWith('+') && !line.startsWith('+++')) {
                            lineStyle = 'text-emerald-400 bg-emerald-950/20';
                          } else if (line.startsWith('-') && !line.startsWith('---')) {
                            lineStyle = 'text-red-400 bg-red-950/20';
                          } else if (line.startsWith('@@')) {
                            lineStyle = 'text-blue-400 bg-blue-950/30';
                          }
                          return (
                            <div key={idx} className={`${lineStyle} px-1.5 py-0.5`}>
                              {line}
                            </div>
                          );
                        })}
                      </pre>
                    ) : (
                      <div className="text-zinc-500 py-6 text-center">
                        No diff detected between {selectedReviewDetail?.targetBranch} and{' '}
                        {selectedReviewDetail?.sourceBranch}.
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments Thread */}
                <div className="space-y-3">
                  <span className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                    Review Discussion ({selectedReviewDetail?.comments?.length ?? 0})
                  </span>

                  <div className="space-y-2">
                    {selectedReviewDetail?.comments?.map((comment: any) => (
                      <div key={comment.id} className="p-3 bg-[#181920] border border-zinc-800 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                          <span className="font-semibold text-zinc-200">{comment.user.displayName}</span>
                          <span>{new Date(comment.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-zinc-200">{comment.content}</div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a review comment or mention @teammate..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingComment || !newCommentText.trim()}
                      className="bg-white hover:bg-zinc-200 text-black text-xs gap-1.5 font-semibold"
                    >
                      <Send className="w-3 h-3" />
                      Comment
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: New Code Review */}
        {isNewReviewModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#121318] border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-white" />
                  <h3 className="font-semibold text-sm text-white">Create New Code Review</h3>
                </div>
                <button
                  onClick={() => setIsNewReviewModalOpen(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createError && (
                <div className="p-3 bg-red-950/40 border border-red-900 rounded-lg text-xs text-red-200">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateReview} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                    Repository *
                  </label>
                  <select
                    value={selectedRepoId}
                    onChange={(e) => setSelectedRepoId(e.target.value)}
                    className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                  >
                    {repositories.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.name} ({repo.localPath || repo.defaultBranch})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                      Source Feature Branch *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="feature/branch-name"
                      value={sourceBranch}
                      onChange={(e) => setSourceBranch(e.target.value)}
                      className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                      Target Branch
                    </label>
                    <input
                      type="text"
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                      className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                    Review Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Brief summary of code changes"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                    Linked Task (Optional)
                  </label>
                  <select
                    value={linkedTaskId}
                    onChange={(e) => setLinkedTaskId(e.target.value)}
                    className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                  >
                    <option value="">None (Independent Review)</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title} [{task.status}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                    Description & Testing Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Instructions for reviewers, breaking changes, testing evidence..."
                    value={reviewDescription}
                    onChange={(e) => setReviewDescription(e.target.value)}
                    className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsNewReviewModalOpen(false)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isCreatingReview || !reviewTitle.trim() || !sourceBranch.trim()}
                    className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs gap-1.5"
                  >
                    {isCreatingReview ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitPullRequest className="w-3.5 h-3.5" />}
                    Create Review
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
