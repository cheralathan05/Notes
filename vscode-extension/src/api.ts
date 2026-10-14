import * as vscode from 'vscode';

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  claimedById?: string;
  claimedBy?: { displayName: string };
  acceptanceCriteria?: Array<{ id: string; text: string; isCompleted: boolean }>;
  isVerified?: boolean;
}

export class AtlasExtensionApi {
  private getBaseUrl(): string {
    const config = vscode.workspace.getConfiguration('atlas');
    return config.get<string>('apiUrl') || 'http://localhost:4000';
  }

  private getToken(): string {
    const config = vscode.workspace.getConfiguration('atlas');
    return config.get<string>('developerToken') || '';
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-atlas-token'] = token;
    }

    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.success) {
      throw new Error(data?.error?.message || `Request failed with status ${res.status}`);
    }

    return data.data;
  }

  async getAssignedTasks(): Promise<TaskItem[]> {
    const data = await this.request<{ tasks: TaskItem[] }>('/api/tasks');
    return data?.tasks || [];
  }

  async claimTask(taskId: string): Promise<any> {
    return this.request(`/api/tasks/${taskId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ leaseMinutes: 180 }),
    });
  }

  async updateTaskStatus(taskId: string, status: string): Promise<any> {
    return this.request(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async submitEvidence(taskId: string, evidence: any): Promise<any> {
    return this.request(`/api/tasks/${taskId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(evidence),
    });
  }

  async getAiCodingPlan(taskId: string): Promise<any> {
    const data = await this.request<{ codingPlan: any }>('/api/ai/coding-plan', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
    return data.codingPlan;
  }
}
