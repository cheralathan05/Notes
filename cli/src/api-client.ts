import { getGlobalConfig, AtlasConfig } from './config';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class AtlasApiClient {
  private config: AtlasConfig;

  constructor(customConfig?: AtlasConfig) {
    this.config = customConfig || getGlobalConfig();
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
      headers['x-atlas-token'] = this.config.token;
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers,
      });

      const json = (await res.json().catch(() => ({
        success: false,
        error: { code: 'INVALID_JSON', message: 'Failed to parse JSON response' },
      }))) as ApiResponse<T>;

      if (!res.ok && json.success) {
        json.success = false;
      }

      return json;
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: `Could not connect to Atlas platform at ${this.config.apiUrl}: ${err.message}`,
        },
      };
    }
  }

  // Authentication & Session
  async loginWithCredentials(email: string, password: string) {
    return this.request<{
      user: { id: string; email: string; displayName: string };
      token: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: { email: string; password: string; confirmPassword?: string; displayName: string }) {
    return this.request<{
      user: { id: string; email: string; displayName: string };
      token: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword || data.password,
        displayName: data.displayName,
      }),
    });
  }

  // Identity & Status
  async getIdentity() {
    return this.request<{
      user: { id: string; email: string; displayName: string };
      activeWorkspaceId?: string;
      workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
      telemetry: { assignedTasksCount: number; claimedTasksCount: number };
    }>('/api/developer/me');
  }

  // Repositories
  async listRepositories(workspaceId?: string) {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.request<{ repositories: any[] }>(`/api/repositories${qs}`);
  }

  async connectRepository(data: {
    repoName: string;
    gitRemoteUrl?: string;
    currentBranch?: string;
    localPath?: string;
    workspaceId?: string;
    projectId?: string;
    latestCommit?: string;
  }) {
    return this.request<{ repository: any; message: string }>('/api/repositories/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async syncRepository(repoId: string) {
    return this.request<{ repository: any; liveMeta: any; message: string }>(`/api/repositories/${repoId}/sync`, {
      method: 'POST',
    });
  }

  // Tasks
  async listTasks(params: { status?: string; projectId?: string; assigneeId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.projectId) qs.set('projectId', params.projectId);
    if (params.assigneeId) qs.set('assigneeId', params.assigneeId);
    return this.request<{ tasks: any[] }>(`/api/tasks?${qs.toString()}`);
  }

  async getTask(taskId: string) {
    return this.request<{ task: any }>(`/api/tasks/${taskId}`);
  }

  async claimTask(taskId: string, leaseMinutes = 120) {
    return this.request<{ task: any; message: string }>(`/api/tasks/${taskId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ leaseMinutes }),
    });
  }

  async releaseTask(taskId: string) {
    return this.request<{ task: any; message: string }>(`/api/tasks/${taskId}/release`, {
      method: 'POST',
    });
  }

  async updateTaskStatus(taskId: string, status: string) {
    return this.request<{ task: any }>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async updateTaskCriteria(taskId: string, criteria: Array<{ id: string; text: string; isCompleted: boolean }>) {
    return this.request<{ task: any }>(`/api/tasks/${taskId}/criteria`, {
      method: 'PATCH',
      body: JSON.stringify({ criteria }),
    });
  }

  // Verification & Evidence Submission
  async submitEvidence(
    taskId: string,
    evidence: {
      command: string;
      exitCode: number;
      stdoutSnippet?: string;
      stderrSnippet?: string;
      commitHash?: string;
      branch?: string;
      changedFiles?: string[];
      pullRequestUrl?: string;
    }
  ) {
    return this.request<{
      evidence: any;
      isVerified: boolean;
      status: string;
      missingCriteria: string[];
      message: string;
    }>(`/api/tasks/${taskId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(evidence),
    });
  }

  async getTaskEvidence(taskId: string) {
    return this.request<{ evidence: any[] }>(`/api/tasks/${taskId}/evidence`);
  }

  async getTaskEligibility(taskId: string) {
    return this.request<{
      task: any;
      eligible: boolean;
      missingCriteria: string[];
      hasPassingCheck: boolean;
      latestEvidence: any;
      blockers: string[];
      claim: {
        isClaimed: boolean;
        claimedByMe: boolean;
        claimedByName?: string;
        leaseExpiresAt?: string;
      };
      requirements: {
        criteriaConfigured: boolean;
        criteriaCount: number;
        criteriaCompletedCount: number;
      };
    }>(`/api/tasks/${taskId}/eligibility`);
  }

  async submitTaskForReview(taskId: string, data?: { notes?: string; prUrl?: string }) {
    return this.request<{ task: any; message: string }>(`/api/tasks/${taskId}/submit-review`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  // AI Developer Assistant
  async getCodingPlan(taskId: string) {
    return this.request<{ codingPlan: any }>('/api/ai/coding-plan', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }

  async getPullRequestDraft(taskId: string, commitHash?: string, branch?: string) {
    return this.request<{ pullRequestDraft: any }>('/api/ai/pr-draft', {
      method: 'POST',
      body: JSON.stringify({ taskId, commitHash, branch }),
    });
  }

  async getHandoffSummary(taskId: string) {
    return this.request<{ handoffSummary: any }>('/api/ai/handoff-summary', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }

  // Projects & Workspaces
  async listProjects() {
    return this.request<{ projects: any[] }>('/api/projects');
  }

  // Workspace Activity Stream
  async getActivity(limit = 25) {
    return this.request<{ activities: any[] }>(`/api/tasks/activity?limit=${limit}`);
  }

  // Task Progress & Update
  async updateTaskProgress(taskId: string, progress: number, note?: string) {
    return this.request<{ task: any }>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ progress, description: note ? undefined : undefined }),
    });
  }
}
