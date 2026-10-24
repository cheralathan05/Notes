// Frontend API client for communicating with the backend
import type { ApiResponse } from './types';

const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE_URL = rawApiUrl
  ? (rawApiUrl.startsWith('http://') || rawApiUrl.startsWith('https://')
      ? rawApiUrl
      : (rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1') ? `http://${rawApiUrl}` : `https://${rawApiUrl}`))
  : (typeof window !== 'undefined' ? '' : 'http://127.0.0.1:4000');

class ApiClient {
  private baseUrl: string;
  private activeWorkspaceId: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      try {
        this.activeWorkspaceId = localStorage.getItem('kronos:active-workspace-id');
      } catch {
        // Ignored in SSR
      }
    }
  }

  public setActiveWorkspaceId(id: string | null): void {
    const previous = this.activeWorkspaceId;
    this.activeWorkspaceId = id;
    if (typeof window !== 'undefined') {
      try {
        if (id) {
          localStorage.setItem('kronos:active-workspace-id', id);
        } else {
          localStorage.removeItem('kronos:active-workspace-id');
        }
        if (previous !== id) {
          window.dispatchEvent(new CustomEvent('kronos:workspace-changed', { detail: { workspaceId: id } }));
        }
      } catch {
        // Ignored
      }
    }
  }

  public getActiveWorkspaceId(): string | null {
    if (!this.activeWorkspaceId && typeof window !== 'undefined') {
      try {
        this.activeWorkspaceId = localStorage.getItem('kronos:active-workspace-id');
      } catch {
        // Ignored
      }
    }
    return this.activeWorkspaceId;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const currentWs = this.getActiveWorkspaceId();
    if (currentWs) {
      headers['x-workspace-id'] = currentWs;
    }

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include', // Always send cookies
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      const data = await response.json() as ApiResponse<T>;
      return data;
    } catch (error) {
      console.error(`API request failed: ${path}`, error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to the server. Please check your connection.',
        },
      };
    }
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async register(data: {
    email: string;
    password: string;
    confirmPassword: string;
    displayName: string;
  }) {
    return this.request<{ user: UserPublic }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{ user: UserPublic }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  async getMe() {
    return this.request<{ user: UserPublic }>('/api/auth/me');
  }

  async verifyEmail(token: string) {
    return this.request<{ message: string }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async resendVerification() {
    return this.request<{ message: string }>('/api/auth/resend-verification', {
      method: 'POST',
    });
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyResetOtp(email: string, otp: string) {
    return this.request<{ resetAuthToken: string; message: string }>('/api/auth/verify-reset-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async resetPassword(data: {
    token: string;
    password: string;
    confirmPassword: string;
  }) {
    return this.request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ─── User ──────────────────────────────────────────────────────────────────

  async updateProfile(data: { displayName?: string; avatarUrl?: string | null }) {
    return this.request<{ user: UserPublic }>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }) {
    return this.request<{ message: string }>('/api/user/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSessions() {
    return this.request<{ sessions: SessionInfo[] }>('/api/user/sessions');
  }

  async revokeSession(sessionId: string) {
    return this.request<{ message: string }>(`/api/user/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async revokeOtherSessions() {
    return this.request<{ message: string; count: number }>(
      '/api/user/sessions/revoke-others',
      { method: 'POST' }
    );
  }

  async completeOnboarding(data: { displayName: string; workspaceName?: string }) {
    return this.request<{ user: UserPublic }>('/api/user/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ─── Documents Platform ───────────────────────────────────────────────────

  async listDocuments(params: {
    folderId?: string;
    parentId?: string;
    isFavorite?: boolean;
    isArchived?: boolean;
    isTrash?: boolean;
    search?: string;
    status?: string;
    tag?: string;
    sort?: string;
    order?: string;
  } = {}) {
    const query = new URLSearchParams();
    if (params.folderId) query.set('folderId', params.folderId);
    if (params.parentId) query.set('parentId', params.parentId);
    if (params.isFavorite !== undefined) query.set('isFavorite', String(params.isFavorite));
    if (params.isArchived !== undefined) query.set('isArchived', String(params.isArchived));
    if (params.isTrash !== undefined) query.set('isTrash', String(params.isTrash));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.tag) query.set('tag', params.tag);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);

    const qStr = query.toString();
    return this.request<{ documents: DocumentItem[]; workspace: { id: string; name: string } }>(
      `/api/documents${qStr ? `?${qStr}` : ''}`
    );
  }

  async getDocument(id: string) {
    return this.request<{ document: DocumentDetail }>(`/api/documents/${id}`);
  }

  async createDocument(data: {
    title?: string;
    folderId?: string | null;
    parentId?: string | null;
    content?: any;
    icon?: string;
    coverImage?: string | null;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  }) {
    return this.request<{ document: DocumentItem }>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDocument(
    id: string,
    data: {
      clientVersion?: number;
      title?: string;
      content?: any;
      icon?: string | null;
      coverImage?: string | null;
      status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
      isFullWidth?: boolean;
      isFavorite?: boolean;
      isPinned?: boolean;
      isArchived?: boolean;
      folderId?: string | null;
      parentId?: string | null;
      orderIndex?: number;
      createSnapshot?: boolean;
    }
  ) {
    return this.request<{ document: DocumentDetail }>(`/api/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async trashDocument(id: string) {
    return this.request<{ message: string }>(`/api/documents/${id}`, {
      method: 'DELETE',
    });
  }

  async restoreDocument(id: string) {
    return this.request<{ document: DocumentItem }>(`/api/documents/${id}/restore`, {
      method: 'POST',
    });
  }

  async permanentDeleteDocument(id: string) {
    return this.request<{ message: string }>(`/api/documents/${id}/permanent`, {
      method: 'DELETE',
    });
  }

  async duplicateDocument(id: string) {
    return this.request<{ document: DocumentItem }>(`/api/documents/${id}/duplicate`, {
      method: 'POST',
    });
  }

  async bulkDocuments(data: {
    action: 'trash' | 'restore' | 'archive' | 'unarchive' | 'move' | 'favorite' | 'delete_permanent';
    documentIds: string[];
    targetFolderId?: string;
  }) {
    return this.request<{ message: string }>('/api/documents/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ─── Folders ──────────────────────────────────────────────────────────────

  async listFolders() {
    return this.request<{ folders: FolderItem[] }>('/api/folders');
  }

  async createFolder(data: { name: string; parentId?: string | null; icon?: string; color?: string }) {
    return this.request<{ folder: FolderItem }>('/api/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFolder(id: string, data: { name?: string; icon?: string; color?: string; parentId?: string | null; orderIndex?: number }) {
    return this.request<{ folder: FolderItem }>(`/api/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteFolder(id: string) {
    return this.request<{ message: string }>(`/api/folders/${id}`, {
      method: 'DELETE',
    });
  }

  // ─── Revisions ────────────────────────────────────────────────────────────

  async listRevisions(documentId: string) {
    return this.request<{ revisions: RevisionItem[] }>(`/api/documents/${documentId}/revisions`);
  }

  async createRevisionSnapshot(documentId: string, description: string) {
    return this.request<{ revision: RevisionItem }>(`/api/documents/${documentId}/revisions`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  }

  async getRevision(documentId: string, revisionId: string) {
    return this.request<{ revision: RevisionDetail }>(`/api/documents/${documentId}/revisions/${revisionId}`);
  }

  async restoreRevision(documentId: string, revisionId: string) {
    return this.request<{ document: DocumentItem; message: string }>(
      `/api/documents/${documentId}/revisions/${revisionId}/restore`,
      { method: 'POST' }
    );
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  async listTemplates(category?: string, search?: string, filter?: string) {
    const q = new URLSearchParams();
    if (category) q.set('category', category);
    if (search) q.set('search', search);
    if (filter) q.set('filter', filter);
    const qs = q.toString();
    return this.request<{ templates: TemplateItem[]; total: number }>(`/api/templates${qs ? `?${qs}` : ''}`);
  }

  async getTemplate(id: string) {
    return this.request<{ template: TemplateItem }>(`/api/templates/${id}`);
  }

  async useTemplate(templateId: string, data: { title?: string; folderId?: string | null } = {}) {
    return this.request<{ document: DocumentItem }>(`/api/templates/${templateId}/use`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async applyTemplateToDocument(templateId: string, documentId: string) {
    return this.request<{ document: DocumentItem }>(`/api/templates/${templateId}/apply-to-document`, {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    });
  }

  async toggleFavoriteTemplate(templateId: string) {
    return this.request<{ template: TemplateItem }>(`/api/templates/${templateId}/favorite`, {
      method: 'POST',
    });
  }

  async duplicateTemplate(templateId: string) {
    return this.request<{ template: TemplateItem }>(`/api/templates/${templateId}/duplicate`, {
      method: 'POST',
    });
  }

  async deleteTemplate(templateId: string) {
    return this.request<{ message: string }>(`/api/templates/${templateId}`, {
      method: 'DELETE',
    });
  }

  async saveAsTemplate(data: { documentId: string; name?: string; description?: string; category?: string }) {
    return this.request<{ template: TemplateItem }>('/api/templates/save-document', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ─── Attachments ──────────────────────────────────────────────────────────

  async uploadAttachment(documentId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}/api/documents/${documentId}/attachments`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: { code: 'UPLOAD_ERROR', message: 'Failed to upload attachment file' },
      };
    }
  }

  async listAttachments(documentId: string) {
    return this.request<{ attachments: AttachmentItem[] }>(`/api/documents/${documentId}/attachments`);
  }

  async deleteAttachment(id: string) {
    return this.request<{ message: string }>(`/api/attachments/${id}`, {
      method: 'DELETE',
    });
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  async searchWorkspace(q: string, filters: { tag?: string; folderId?: string; status?: string } = {}) {
    const params = new URLSearchParams({ q });
    if (filters.tag) params.set('tag', filters.tag);
    if (filters.folderId) params.set('folderId', filters.folderId);
    if (filters.status) params.set('status', filters.status);
    return this.request<{ results: SearchResultItem[] }>(`/api/search?${params.toString()}`);
  }

  async getRecentDocuments() {
    return this.request<{ documents: SearchResultItem[] }>('/api/search/recent');
  }

  // ─── AI Writing & Assistants ──────────────────────────────────────────────

  async aiTransform(data: {
    action: 'summarize' | 'rewrite' | 'grammar' | 'tone' | 'continue' | 'headings' | 'meeting_summary' | 'extract_tasks' | 'translate' | 'explain';
    text: string;
    tone?: string;
    targetLanguage?: string;
  }) {
    return this.request<{ result: string; action: string }>('/api/ai/transform', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async aiQa(question: string, documentId?: string) {
    return this.request<{ answer: string; source: string }>('/api/ai/qa', {
      method: 'POST',
      body: JSON.stringify({ question, documentId }),
    });
  }

  async aiDraft(prompt: string, topic?: string) {
    return this.request<{ content: any; plainText: string; title: string }>('/api/ai/draft', {
      method: 'POST',
      body: JSON.stringify({ prompt, topic }),
    });
  }

  // ─── Collaboration & Sharing ──────────────────────────────────────────────

  async listComments(documentId: string) {
    return this.request<{ comments: CommentItem[] }>(`/api/documents/${documentId}/comments`);
  }

  async addComment(documentId: string, data: { content: string; selectedText?: string | null; parentId?: string | null }) {
    return this.request<{ comment: CommentItem }>(`/api/documents/${documentId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resolveComment(commentId: string, isResolved: boolean) {
    return this.request<{ comment: CommentItem }>(`/api/documents/comments/${commentId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ isResolved }),
    });
  }

  async getShareSettings(documentId: string) {
    return this.request<{ shareToken: string; isPublic: boolean; permission: string; isPublished: boolean }>(
      `/api/documents/${documentId}/share`
    );
  }

  async updateShareSettings(documentId: string, data: { isPublic?: boolean; permission?: 'VIEW' | 'COMMENT' | 'EDIT'; publish?: boolean }) {
    return this.request<{ shareToken: string; isPublic: boolean; permission: string }>(
      `/api/documents/${documentId}/share`,
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async getDocumentActivity(documentId: string) {
    return this.request<{ activities: ActivityItem[] }>(`/api/documents/${documentId}/activity`);
  }

  // ─── Import / Export ──────────────────────────────────────────────────────

  async importDocument(data: { title: string; contentText: string; format?: string; folderId?: string | null }) {
    return this.request<{ document: DocumentItem }>('/api/documents/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getExportUrl(documentId: string, format: 'markdown' | 'html' | 'txt' | 'pdf' | 'docx') {
    return `${this.baseUrl}/api/documents/${documentId}/export?format=${format}`;
  }

  async getPublicDocument(token: string) {
    return this.request<{ document: DocumentDetail; permission: string; isPublic: boolean }>(
      `/api/public/documents/${token}`
    );
  }

  // ─── Sharing & Access Control (Real Memberships, Invites, Public Link, Publishing) ──

  async getDocumentAccess(documentId: string) {
    return this.request<DocumentAccessData>(`/api/documents/${documentId}/access`);
  }

  async inviteCollaborator(
    documentId: string,
    data: { recipientEmail: string; role?: DocumentRoleType; message?: string }
  ) {
    return this.request<{
      invitation: { id: string; recipientEmail: string; role: DocumentRoleType; expiresAt: string; status: string };
      emailSent?: boolean;
      message: string;
    }>(`/api/documents/${documentId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendInvitation(documentId: string, invitationId: string) {
    return this.request<{ invitation: any; emailSent?: boolean; message: string }>(
      `/api/documents/${documentId}/invitations/${invitationId}/resend`,
      { method: 'POST' }
    );
  }

  async revokeInvitation(documentId: string, invitationId: string) {
    return this.request<{ message: string }>(
      `/api/documents/${documentId}/invitations/${invitationId}`,
      { method: 'DELETE' }
    );
  }

  async updateCollaboratorRole(documentId: string, memberUserId: string, role: DocumentRoleType) {
    return this.request<{ membership: any; message: string }>(
      `/api/documents/${documentId}/collaborators/${memberUserId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }
    );
  }

  async removeCollaborator(documentId: string, memberUserId: string) {
    return this.request<{ message: string }>(
      `/api/documents/${documentId}/collaborators/${memberUserId}`,
      { method: 'DELETE' }
    );
  }

  async configurePublicLink(
    documentId: string,
    data: { isEnabled?: boolean; permission?: 'VIEW' | 'EDIT'; password?: string; expiresAt?: string | null }
  ) {
    return this.request<{ publicLink: DocumentPublicLinkState; message: string }>(
      `/api/documents/${documentId}/public-link`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async publishDocument(documentId: string, title?: string) {
    return this.request<{ document: DocumentItem; publication: any; message: string }>(
      `/api/documents/${documentId}/publish`,
      {
        method: 'POST',
        body: JSON.stringify({ title }),
      }
    );
  }

  async unpublishDocument(documentId: string) {
    return this.request<{ document: DocumentItem; message: string }>(
      `/api/documents/${documentId}/unpublish`,
      { method: 'POST' }
    );
  }

  async getInvitationDetails(token: string) {
    return this.request<InvitationDetails>(`/api/public/invitations/${token}`);
  }

  async acceptInvitation(token: string) {
    return this.request<{
      documentId?: string;
      documentTitle?: string;
      role?: DocumentRoleType;
      message: string;
      workspaceId?: string;
      redirectUrl?: string;
    }>(
      '/api/invitations/accept',
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      }
    );
  }

  // ─── Tasks (Notes-to-Actions Engine) ────────────────────────────────────────

  async listTasks(params: { documentId?: string; status?: string } = {}) {
    const searchParams = new URLSearchParams();
    if (params.documentId) searchParams.set('documentId', params.documentId);
    if (params.status) searchParams.set('status', params.status);
    return this.request<{ tasks: TaskItem[] }>(`/api/tasks?${searchParams.toString()}`);
  }

  // ─── Tasks & Project Management OS ──────────────────────────────────────

  async getTasks(params: {
    projectId?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    dueFilter?: 'today' | 'overdue' | 'upcoming';
    search?: string;
    parentOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    documentId?: string;
  } = {}) {
    const query = new URLSearchParams();
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.status) query.set('status', params.status);
    if (params.priority) query.set('priority', params.priority);
    if (params.assigneeId) query.set('assigneeId', params.assigneeId);
    if (params.dueFilter) query.set('dueFilter', params.dueFilter);
    if (params.search) query.set('search', params.search);
    if (params.parentOnly !== undefined) query.set('parentOnly', String(params.parentOnly));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.documentId) query.set('documentId', params.documentId);

    const queryString = query.toString();
    return this.request<{ tasks: TaskItem[]; count: number }>(`/api/tasks${queryString ? `?${queryString}` : ''}`);
  }

  async getTask(id: string) {
    return this.request<{ task: TaskItem }>(`/api/tasks/${id}`);
  }

  async createTask(data: {
    title: string;
    description?: string;
    status?: TaskStatusType;
    documentId?: string;
    projectId?: string;
    assigneeId?: string;
    parentId?: string;
    priority?: TaskPriorityType;
    dueDate?: string;
    startDate?: string;
    estimatedHours?: number;
    acceptanceCriteria?: any;
  }) {
    return this.request<{ task: TaskItem }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async batchCreateTasks(documentId: string, tasks: Array<{ title: string; priority?: string; dueDate?: string }>) {
    return this.request<{ tasks: TaskItem[]; count: number }>('/api/tasks/batch', {
      method: 'POST',
      body: JSON.stringify({ documentId, tasks }),
    });
  }

  async updateTask(id: string, data: Partial<TaskItem> & { [key: string]: any }) {
    return this.request<{ task: TaskItem }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request<{ deleted: boolean }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkTasks(taskIds: string[], action: 'complete' | 'reopen' | 'delete' | 'archive' | 'status' | 'priority' | 'assign', data?: any) {
    return this.request<{ affected: number }>('/api/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({ taskIds, action, data }),
    });
  }

  async getMyDayTasks() {
    return this.request<MyDayData>('/api/tasks/my-day');
  }

  async addChecklistItem(taskId: string, title: string) {
    return this.request<{ item: TaskChecklistItemType }>(`/api/tasks/${taskId}/checklists`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async toggleChecklistItem(taskId: string, itemId: string, isCompleted: boolean) {
    return this.request<{ item: TaskChecklistItemType }>(`/api/tasks/${taskId}/checklists/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted }),
    });
  }

  async addDependency(blockedTaskId: string, blockingTaskId: string) {
    return this.request<{ dependency: any }>(`/api/tasks/${blockedTaskId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ blockingTaskId }),
    });
  }

  async removeDependency(blockedTaskId: string, blockingTaskId: string) {
    return this.request<{ removed: boolean }>(`/api/tasks/${blockedTaskId}/dependencies/${blockingTaskId}`, {
      method: 'DELETE',
    });
  }

  async getTaskLabels() {
    return this.request<{ labels: Array<{ id: string; name: string; color: string }> }>('/api/tasks/labels');
  }

  async createTaskLabel(name: string, color?: string) {
    return this.request<{ label: { id: string; name: string; color: string } }>('/api/tasks/labels', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
  }

  async addTaskLabel(taskId: string, data: { labelId?: string; name?: string; color?: string }) {
    return this.request<{ assignment: any }>(`/api/tasks/${taskId}/labels`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeTaskLabel(taskId: string, labelId: string) {
    return this.request<{ removed: boolean }>(`/api/tasks/${taskId}/labels/${labelId}`, {
      method: 'DELETE',
    });
  }

  async addTaskComment(taskId: string, content: string) {
    return this.request<{ comment: TaskCommentItemType }>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // ─── Projects API ──────────────────────────────────────────────────────────

  async getProjects(statusOrOptions?: string | { search?: string; status?: string; includeArchived?: boolean; sortBy?: string; sortOrder?: string; workspaceId?: string }) {
    let query = '';
    if (typeof statusOrOptions === 'string') {
      const trimmed = statusOrOptions.trim().toUpperCase();
      if (trimmed && trimmed !== 'ALL' && !trimmed.includes('OBJECT')) {
        query = `?status=${encodeURIComponent(trimmed)}`;
      }
    } else if (statusOrOptions && typeof statusOrOptions === 'object') {
      const p = new URLSearchParams();
      if (statusOrOptions.search && typeof statusOrOptions.search === 'string') p.set('search', statusOrOptions.search.trim());
      if (statusOrOptions.status && typeof statusOrOptions.status === 'string') {
        const trimmed = statusOrOptions.status.trim().toUpperCase();
        if (trimmed && trimmed !== 'ALL' && !trimmed.includes('OBJECT')) {
          p.set('status', trimmed);
        }
      }
      if (statusOrOptions.includeArchived) p.set('includeArchived', 'true');
      if (statusOrOptions.sortBy) p.set('sortBy', String(statusOrOptions.sortBy));
      if (statusOrOptions.sortOrder) p.set('sortOrder', String(statusOrOptions.sortOrder));
      if (statusOrOptions.workspaceId) p.set('workspaceId', String(statusOrOptions.workspaceId));
      const str = p.toString();
      query = str ? `?${str}` : '';
    }
    return this.request<{ projects: ProjectItem[] }>(`/api/projects${query}`);
  }

  async getProject(id: string) {
    return this.request<{ project: ProjectItem }>(`/api/projects/${id}`);
  }

  async createProject(data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    startDate?: string;
    targetDate?: string;
  }) {
    return this.request<{ project: ProjectItem }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: Partial<ProjectItem>) {
    return this.request<{ project: ProjectItem }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string) {
    return this.request<{ deleted: boolean }>(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async recalculateProjectProgress(id: string) {
    return this.request<any>(`/api/projects/${id}/progress`, {
      method: 'POST',
    });
  }

  async addMilestone(projectId: string, data: { title: string; description?: string; targetDate?: string }) {
    return this.request<{ milestone: any }>(`/api/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMilestone(projectId: string, milestoneId: string, data: { isCompleted?: boolean; title?: string; targetDate?: string; description?: string }) {
    return this.request<{ milestone: any }>(`/api/projects/${projectId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteMilestone(projectId: string, milestoneId: string) {
    return this.request<{ deleted: boolean }>(`/api/projects/${projectId}/milestones/${milestoneId}`, {
      method: 'DELETE',
    });
  }

  // ─── Terminal Command Center API ───────────────────────────────────────────

  async executeTerminalCommand(command: string) {
    return this.request<TerminalExecutionData>('/api/tasks/terminal/execute', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  }

  async getTerminalSuggestions(q: string) {
    return this.request<{ suggestions: Array<{ text: string; description: string; category: string }> }>(
      `/api/tasks/terminal/suggestions?q=${encodeURIComponent(q)}`
    );
  }

  // ─── Notifications API ───────────────────────────────────────────────────

  async getNotifications(options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.unreadOnly) params.set('unreadOnly', 'true');
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    const qs = params.toString();
    return this.request<{ notifications: NotificationItem[]; total: number; unreadCount: number }>(
      `/api/notifications${qs ? `?${qs}` : ''}`
    );
  }

  async markNotificationRead(id: string) {
    return this.request<{ notification: NotificationItem }>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request<{ count: number }>('/api/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  // ─── Focus & Time Tracking API ─────────────────────────────────────────────

  async getActiveFocusSession() {
    return this.request<{ session: FocusSessionItem | null }>('/api/focus/active');
  }

  async startFocusSession(data: { taskId?: string; title: string; targetMinutes?: number; notes?: string }) {
    return this.request<{ session: FocusSessionItem }>('/api/focus/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async pauseFocusSession(id: string) {
    return this.request<{ session: FocusSessionItem }>(`/api/focus/${id}/pause`, {
      method: 'POST',
    });
  }

  async resumeFocusSession(id: string) {
    return this.request<{ session: FocusSessionItem }>(`/api/focus/${id}/resume`, {
      method: 'POST',
    });
  }

  async completeFocusSession(id: string, notes?: string, distractions?: number) {
    return this.request<{ session: FocusSessionItem }>(`/api/focus/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes, distractions }),
    });
  }

  async cancelFocusSession(id: string) {
    return this.request<{ session: FocusSessionItem }>(`/api/focus/${id}/cancel`, {
      method: 'POST',
    });
  }

  async recordDistraction(id: string, note?: string) {
    return this.request<{ session: FocusSessionItem }>(`/api/focus/${id}/distraction`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  async getFocusTotals() {
    return this.request<{
      todayMinutes: number;
      todayHours: number;
      weekMinutes: number;
      weekHours: number;
      completedCountToday?: number;
      completedCountWeek?: number;
    }>('/api/focus/totals');
  }

  async getFocusSessionHistory(options: { limit?: number; taskId?: string } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.taskId) params.set('taskId', options.taskId);
    const qs = params.toString();
    return this.request<{ sessions: FocusSessionItem[] }>(`/api/focus/history${qs ? `?${qs}` : ''}`);
  }

  async getTimeEntries(options: { taskId?: string; projectId?: string } = {}) {
    const params = new URLSearchParams();
    if (options.taskId) params.set('taskId', options.taskId);
    if (options.projectId) params.set('projectId', options.projectId);
    const qs = params.toString();
    return this.request<{ entries: TimeEntryItem[] }>(`/api/focus/entries${qs ? `?${qs}` : ''}`);
  }

  // ─── Goals & OKRs API ───────────────────────────────────────────────────────

  async getGoals(optionsOrStatus?: string | { status?: string; category?: string; search?: string; projectId?: string }, categoryParam?: string) {
    const params = new URLSearchParams();
    if (typeof optionsOrStatus === 'string') {
      if (optionsOrStatus && optionsOrStatus !== 'ALL') params.set('status', optionsOrStatus);
      if (categoryParam && categoryParam !== 'ALL') params.set('category', categoryParam);
    } else if (optionsOrStatus && typeof optionsOrStatus === 'object') {
      if (optionsOrStatus.status && optionsOrStatus.status !== 'ALL') params.set('status', optionsOrStatus.status);
      if (optionsOrStatus.category && optionsOrStatus.category !== 'ALL') params.set('category', optionsOrStatus.category);
      if (optionsOrStatus.search) params.set('search', optionsOrStatus.search);
      if (optionsOrStatus.projectId) params.set('projectId', optionsOrStatus.projectId);
    }
    const qs = params.toString();
    return this.request<{ goals: GoalItem[] }>(`/api/goals${qs ? `?${qs}` : ''}`);
  }

  async getGoalMetrics() {
    return this.request<GoalMetricsData>('/api/goals/metrics');
  }

  async getGoal(id: string) {
    return this.request<{ goal: GoalItem }>(`/api/goals/${id}`);
  }

  async createGoal(data: {
    title: string;
    description?: string;
    category?: string;
    targetValue?: number;
    currentValue?: number;
    unit?: string;
    targetDate?: string;
    timePeriod?: string;
    ownerId?: string;
    projectId?: string;
    status?: string;
    keyResults?: Array<{
      title: string;
      description?: string;
      type?: 'INCREASE' | 'DECREASE' | 'BINARY' | 'MILESTONE';
      startValue?: number;
      targetValue?: number;
      currentValue?: number;
      unit?: string;
      weight?: number;
    }>;
  }) {
    return this.request<{ goal: GoalItem }>('/api/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateGoal(id: string, data: Partial<GoalItem>) {
    return this.request<{ goal: GoalItem }>(`/api/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async checkInGoal(id: string, data: { newValue: number; note?: string }) {
    return this.request<{ goal: GoalItem; checkIn: any }>(`/api/goals/${id}/check-in`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addKeyResult(goalId: string, data: {
    title: string;
    description?: string;
    type?: 'INCREASE' | 'DECREASE' | 'BINARY' | 'MILESTONE';
    startValue?: number;
    targetValue?: number;
    currentValue?: number;
    unit?: string;
    weight?: number;
    ownerId?: string;
    dueDate?: string;
  }) {
    return this.request<{ keyResult: KeyResultItem }>(`/api/goals/${goalId}/key-results`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateKeyResult(krId: string, data: {
    newValue?: number;
    note?: string;
    title?: string;
    status?: string;
    dueDate?: string;
  }) {
    return this.request<{ keyResult: KeyResultItem }>(`/api/goals/key-results/${krId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteKeyResult(krId: string) {
    return this.request<{ deleted: boolean }>(`/api/goals/key-results/${krId}`, {
      method: 'DELETE',
    });
  }

  async deleteGoal(id: string) {
    return this.request<{ deleted: boolean }>(`/api/goals/${id}`, {
      method: 'DELETE',
    });
  }

  // ─── Automations API ───────────────────────────────────────────────────────

  async getAutomations() {
    return this.request<{ automations: AutomationItem[] }>('/api/automations');
  }

  async createAutomation(data: {
    name: string;
    description?: string;
    triggerType: string;
    triggerConfig?: any;
    conditions?: Array<{ field: string; operator: string; value: any }>;
    actions: Array<{ type: string; params: any }>;
    isEnabled?: boolean;
  }) {
    return this.request<{ automation: AutomationItem }>('/api/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleAutomation(id: string, isEnabled: boolean) {
    return this.request<{ automation: AutomationItem }>(`/api/automations/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled }),
    });
  }

  async deleteAutomation(id: string) {
    return this.request<{ deleted: boolean }>(`/api/automations/${id}`, {
      method: 'DELETE',
    });
  }

  // ─── Analytics & Command Center API ────────────────────────────────────────

  async getDailyCommandCenter() {
    return this.request<DailyCommandCenterData>('/api/analytics/command-center');
  }

  async getWorkspaceAnalytics(params?: { projectId?: string; dateRange?: string }) {
    const query = new URLSearchParams();
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.dateRange) query.append('dateRange', params.dateRange);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<WorkspaceAnalyticsData>(`/api/analytics/workspace${qs}`);
  }

  // ─── Project Atlas Developer Workspace API ──────────────────────────────────

  async claimTask(taskId: string, leaseMinutes = 120) {
    return this.request<{ task: TaskItem; message: string }>(`/api/tasks/${taskId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ leaseMinutes }),
    });
  }

  async releaseTask(taskId: string) {
    return this.request<{ task: TaskItem; message: string }>(`/api/tasks/${taskId}/release`, {
      method: 'POST',
    });
  }

  async updateTaskCriteria(taskId: string, criteria: Array<{ id: string; text: string; isCompleted: boolean }>) {
    return this.request<{ task: TaskItem }>(`/api/tasks/${taskId}/criteria`, {
      method: 'PATCH',
      body: JSON.stringify({ criteria }),
    });
  }

  async submitEvidence(taskId: string, evidence: {
    command: string;
    exitCode: number;
    stdoutSnippet?: string;
    stderrSnippet?: string;
    commitHash?: string;
    branch?: string;
    changedFiles?: string[];
    pullRequestUrl?: string;
  }) {
    return this.request<{
      evidence: TaskEvidenceItem;
      isVerified: boolean;
      status: TaskStatusType;
      missingCriteria: string[];
      message: string;
    }>(`/api/tasks/${taskId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(evidence),
    });
  }

  async getTaskEvidence(taskId: string) {
    return this.request<{ evidence: TaskEvidenceItem[] }>(`/api/tasks/${taskId}/evidence`);
  }

  async listRepositories(workspaceId?: string) {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.request<{ repositories: RepositoryItem[] }>(`/api/repositories${qs}`);
  }

  async createRepository(data: {
    name: string;
    slug?: string;
    gitUrl?: string;
    defaultBranch?: string;
    localPath?: string;
    projectId?: string;
    description?: string;
    workspaceId?: string;
  }) {
    return this.request<{ repository: RepositoryItem }>('/api/repositories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteRepository(id: string) {
    return this.request<{ message: string }>(`/api/repositories/${id}`, {
      method: 'DELETE',
    });
  }

  async listDeveloperTokens() {
    return this.request<{ tokens: DeveloperTokenItem[] }>('/api/developer/tokens');
  }

  async getDeveloperTokens() {
    return this.listDeveloperTokens();
  }

  async createDeveloperToken(
    nameOrOptions: string | { name?: string; expiresInDays?: number } = 'Developer CLI Token',
    expiresInDaysParam = 90
  ) {
    let name = 'Developer CLI Token';
    let expiresInDays = expiresInDaysParam;

    if (typeof nameOrOptions === 'string') {
      name = nameOrOptions;
    } else if (nameOrOptions && typeof nameOrOptions === 'object') {
      if (nameOrOptions.name) name = nameOrOptions.name;
      if (nameOrOptions.expiresInDays) expiresInDays = nameOrOptions.expiresInDays;
    }

    return this.request<{
      token: string;
      rawToken?: string;
      tokenRecord: DeveloperTokenItem;
      instructions: string;
    }>('/api/developer/tokens', {
      method: 'POST',
      body: JSON.stringify({ name, expiresInDays }),
    });
  }

  async revokeDeveloperToken(id: string) {
    return this.request<{ message: string }>(`/api/developer/tokens/${id}`, {
      method: 'DELETE',
    });
  }

  async getAiCodingPlan(taskId: string) {
    return this.request<{ codingPlan: any }>('/api/ai/coding-plan', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }

  async getAiPrDraft(taskId: string, commitHash?: string, branch?: string) {
    return this.request<{ pullRequestDraft: any }>('/api/ai/pr-draft', {
      method: 'POST',
      body: JSON.stringify({ taskId, commitHash, branch }),
    });
  }


  // ─── Workspace Operations ──────────────────────────────────────────────────
  async listWorkspaces() {
    return this.request<{ workspaces: WorkspacePublic[] }>('/api/collaboration/workspaces');
  }

  async createWorkspace(data: { name: string; description?: string }) {
    return this.request<{ workspace: WorkspacePublic }>('/api/collaboration/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async demoLogin(role: 'owner' | 'collaborator' = 'owner') {
    return this.request<{ user: UserPublic }>(`/api/auth/demo-login?role=${role}`, {
      method: 'POST',
    });
  }

  // ─── Repositories & Integrations ───────────────────────────────────────────
  async getGitHubStatus(workspaceId?: string) {
    const qs = workspaceId ? `?workspaceId=${workspaceId}` : '';
    return this.request<{ isConnected: boolean; accounts?: any[] }>(`/api/integrations/github/status${qs}`);
  }

  async listGitHubRepos(workspaceId?: string) {
    const qs = workspaceId ? `?workspaceId=${workspaceId}` : '';
    return this.request<{ repositories: any[] }>(`/api/integrations/github/repos${qs}`);
  }

  async connectGitHub(data: any) {
    return this.request<{ connection: any }>('/api/integrations/github/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async disconnectGitHub() {
    return this.request<{ success: boolean }>('/api/integrations/github/disconnect', {
      method: 'POST',
    });
  }

  async importGitHubRepo(data: any) {
    return this.request<{ repository: any }>('/api/integrations/github/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRepository(id: string) {
    return this.request<{ repository: RepositoryItem }>(`/api/repositories/${id}`);
  }

  async getRepositoryBranches(id: string) {
    return this.request<{ branches: GitBranchItem[] }>(`/api/repositories/${id}/branches`);
  }

  async getRepositoryCommits(id: string, limitOrBranch: string | number = 30) {
    const param = typeof limitOrBranch === 'number' ? ('limit=' + limitOrBranch) : ('branch=' + limitOrBranch);
    return this.request<{ commits: GitCommitItem[] }>('/api/repositories/' + id + '/commits?' + param);
  }

  async getRepositoryStatus(id: string) {
    return this.request<{ status: any }>('/api/repositories/' + id + '/status');
  }

  async getGitHubActivity(ownerOrRepoId: string, repoName?: string) {
    const p = repoName
      ? ('/api/integrations/github/activity?owner=' + ownerOrRepoId + '&repo=' + repoName)
      : ('/api/integrations/github/repos/' + ownerOrRepoId + '/activity');
    return this.request<GitHubActivity>(p);
  }

  async getRepositoryDiff(id: string, branch?: string) {
    const qs = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    return this.request<{ diff: string; files?: any[] }>(`/api/repositories/${id}/diff${qs}`);
  }

  async syncRepository(id: string) {
    return this.request<{ repository: RepositoryItem }>(`/api/repositories/${id}/sync`, {
      method: 'POST',
    });
  }

  async linkTaskToRepository(repositoryId: string, taskId: string, branchName?: string) {
    return this.request<{ link: any }>(`/api/repositories/${repositoryId}/tasks/${taskId}/link`, {
      method: 'POST',
      body: JSON.stringify({ branchName }),
    });
  }

  async unlinkTaskFromRepository(repositoryId: string, taskId: string) {
    return this.request<{ success: boolean }>(`/api/repositories/${repositoryId}/tasks/${taskId}/link`, {
      method: 'DELETE',
    });
  }

  // ─── Code Reviews ───────────────────────────────────────────────────────────
  async listCodeReviews(repositoryId?: string) {
    const qs = repositoryId ? `?repositoryId=${repositoryId}` : '';
    return this.request<{ reviews: CodeReviewItem[] }>(`/api/reviews${qs}`);
  }

  async getCodeReview(id: string) {
    return this.request<{ review: CodeReviewDetail; diff?: string }>(`/api/reviews/${id}`);
  }

  async createCodeReview(data: any) {
    return this.request<{ review: CodeReviewItem }>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addCodeReviewComment(reviewId: string, data: any) {
    return this.request<{ comment: any }>(`/api/reviews/${reviewId}/comments`, {
      method: 'POST',
      body: JSON.stringify(typeof data === 'string' ? { content: data } : data),
    });
  }

  async submitCodeReviewAction(reviewId: string, actionOrData: any, comment?: string) {
    const payload = typeof actionOrData === 'string' ? { action: actionOrData, comment } : actionOrData;
    return this.request<{ review: any; action: any }>(`/api/reviews/${reviewId}/actions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ─── Canvases ──────────────────────────────────────────────────────────────
  async listCanvases() {
    return this.request<{ canvases: CanvasItem[] }>('/api/canvases');
  }

  async getCanvas(id: string) {
    return this.request<{ canvas: CanvasItem }>(`/api/canvases/${id}`);
  }

  async createCanvas(data: any) {
    return this.request<{ canvas: CanvasItem }>('/api/canvases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCanvas(id: string, data: any) {
    return this.request<{ canvas: CanvasItem }>(`/api/canvases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async duplicateCanvas(id: string) {
    return this.request<{ canvas: CanvasItem }>(`/api/canvases/${id}/duplicate`, {
      method: 'POST',
    });
  }

  async getCanvasTemplates() {
    return this.request<{ templates: Record<string, any> }>('/api/canvases/templates');
  }


  // ─── Collaboration Extended ───────────────────────────────────────────────
  async getCollaborationOverview(workspaceId?: string) {
    const qs = workspaceId ? ('?workspaceId=' + workspaceId) : '';
    return this.request<any>('/api/collaboration/overview' + qs);
  }

  async listWorkspaceMembers(params?: string | { workspaceId?: string; search?: string; role?: string; page?: number; limit?: number }) {
    if (typeof params === 'string') {
      const qs = params ? ('?workspaceId=' + params) : '';
      return this.request<any>('/api/collaboration/members' + qs);
    }
    const searchParams = new URLSearchParams();
    if (params?.workspaceId) searchParams.set('workspaceId', params.workspaceId);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.role) searchParams.set('role', params.role);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return this.request<any>('/api/collaboration/members' + (qs ? ('?' + qs) : ''));
  }

  async listPendingInvitations(workspaceId?: string) {
    const qs = workspaceId ? ('?workspaceId=' + workspaceId) : '';
    return this.request<any>('/api/collaboration/invitations/pending' + qs);
  }

  async getWorkspaceActivity(params?: string | { workspaceId?: string; limit?: number }) {
    if (typeof params === 'string') {
      const qs = params ? ('?workspaceId=' + params) : '';
      return this.request<any>('/api/collaboration/activity' + qs);
    }
    const searchParams = new URLSearchParams();
    if (params?.workspaceId) searchParams.set('workspaceId', params.workspaceId);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return this.request<any>('/api/collaboration/activity' + (qs ? ('?' + qs) : ''));
  }

  async sendPresenceHeartbeat(params: string | { workspaceId: string; status?: string; activeDocumentId?: string }, status?: string) {
    const body = typeof params === 'string' ? { workspaceId: params, status } : params;
    return this.request<any>('/api/collaboration/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateWorkspace(id: string, data: any) {
    return this.request<any>('/api/collaboration/workspaces/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async inviteWorkspaceMember(data: any) {
    return this.request<any>('/api/collaboration/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendWorkspaceInvitation(id: string) {
    return this.request<any>('/api/collaboration/invitations/' + id + '/resend', {
      method: 'POST',
    });
  }

  async revokeWorkspaceInvitation(id: string) {
    return this.request<any>('/api/collaboration/invitations/' + id, {
      method: 'DELETE',
    });
  }

  async updateWorkspaceMemberRole(first: string, second: string, third?: string) {
    const memberId = third ? second : first;
    const role = third ? third : second;
    return this.request<any>('/api/collaboration/members/' + memberId + '/role', {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removeWorkspaceMember(first: string, second?: string) {
    const memberId = second ? second : first;
    return this.request<any>('/api/collaboration/members/' + memberId, {
      method: 'DELETE',
    });
  }

  async archiveProject(id: string) {
    return this.request<{ project: ProjectItem }>(`/api/projects/${id}/archive`, {
      method: 'POST',
    });
  }

  async unarchiveProject(id: string) {
    return this.request<{ project: ProjectItem }>(`/api/projects/${id}/unarchive`, {
      method: 'POST',
    });
  }

  // ─── Chat Operations ──────────────────────────────────────────────────────
  async getChatChannels() {
    return this.request<any>('/api/chat/channels');
  }

  async getChatMessages(channel?: string, limit?: number) {
    const p = new URLSearchParams();
    if (channel) p.set('channel', channel);
    if (limit) p.set('limit', String(limit));
    const qs = p.toString();
    return this.request<any>(`/api/chat/messages${qs ? `?${qs}` : ''}`);
  }

  async sendChatMessage(data: any) {
    return this.request<any>('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleChatReaction(messageId: string, emoji: string) {
    return this.request<any>(`/api/chat/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  async toggleChatPin(messageId: string) {
    return this.request<any>(`/api/chat/messages/${messageId}/pin`, {
      method: 'PATCH',
    });
  }

  async deleteChatMessage(messageId: string) {
    return this.request<any>(`/api/chat/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async editChatMessage(messageId: string, content: string) {
    return this.request<any>(`/api/chat/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  }

  async createChatChannel(data: { name: string; description?: string; topic?: string; isPrivate?: boolean }) {
    return this.request<any>('/api/chat/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChatChannel(id: string, data: { topic?: string; description?: string; isArchived?: boolean; name?: string }) {
    return this.request<any>(`/api/chat/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getChatChannelMembers(channelId: string) {
    return this.request<any>(`/api/chat/channels/${channelId}/members`);
  }

  async addChatChannelMember(channelId: string, targetUserId: string, role = 'MEMBER') {
    return this.request<any>(`/api/chat/channels/${channelId}/members`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, role }),
    });
  }

  async removeChatChannelMember(channelId: string, targetUserId: string) {
    return this.request<any>(`/api/chat/channels/${channelId}/members/${targetUserId}`, {
      method: 'DELETE',
    });
  }

  async searchChatMessages(q: string, channel?: string) {
    const p = new URLSearchParams({ q });
    if (channel) p.set('channel', channel);
    return this.request<any>(`/api/chat/search?${p.toString()}`);
  }

  async deleteCanvas(id: string) {
    return this.request<{ deleted: boolean; canvasId: string }>(`/api/canvases/${id}`, {
      method: 'DELETE',
    });
  }

  async getAiHandoffSummary(taskId: string) {
    return this.request<{ handoffSummary: any }>('/api/ai/handoff-summary', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface UserPublic {
  id: string;
  email: string;
  emailNormalized?: string;
  displayName: string;
  emailVerified: boolean;
  onboardingComplete: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

export interface DocumentItem {
  id: string;
  workspaceId: string;
  creatorId: string;
  folderId: string | null;
  parentId: string | null;
  title: string;
  icon: string | null;
  coverImage: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  orderIndex: number;
  isFullWidth: boolean;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  folder?: { id: string; name: string; icon: string | null } | null;
  tags?: { id: string; name: string; color: string | null }[];
  creator?: { id: string; displayName: string; email: string; avatarUrl: string | null };
  _count?: { children: number; comments: number; attachments: number; revisions: number };
}

export interface DocumentDetail extends DocumentItem {
  content: any;
  plainText: string | null;
  parent?: { id: string; title: string; icon: string | null } | null;
  children?: { id: string; title: string; icon: string | null; updatedAt: string; orderIndex: number }[];
  breadcrumbs?: { id: string; title: string; type: 'workspace' | 'folder' | 'document' }[];
  userRole?: string;
}

export interface FolderItem {
  id: string;
  workspaceId: string;
  creatorId: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number; children: number };
}

export interface RevisionItem {
  id: string;
  version: number;
  title: string;
  description: string | null;
  createdAt: string;
  creator: { id: string; displayName: string; email: string };
}

export interface RevisionDetail extends RevisionItem {
  content: any;
}

export interface TemplateItem {
  id: string;
  slug?: string | null;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  content?: any;
  tags?: string | null;
  isSystem: boolean;
  isFavorite?: boolean;
  usageCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AttachmentItem {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
  createdAt: string;
  uploader: { id: string; displayName: string; email: string };
}

export interface SearchResultItem {
  id: string;
  title: string;
  icon: string;
  folder?: { id: string; name: string; icon: string | null } | null;
  snippet?: string;
  score?: number;
  updatedAt: string;
}

export interface CommentItem {
  id: string;
  documentId: string;
  authorId: string;
  content: string;
  selectedText: string | null;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
  replies?: CommentItem[];
}

export interface ActivityItem {
  id: string;
  documentId: string;
  userId: string;
  action: string;
  metadata?: any;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
}

export type DocumentRoleType = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER';
export type InvitationStatusType = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface DocumentCollaboratorMember {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: DocumentRoleType;
  createdAt: string;
}

export interface DocumentPendingInvitation {
  id: string;
  recipientEmail: string;
  role: DocumentRoleType;
  createdAt: string;
  expiresAt: string;
  inviterName: string;
}

export interface DocumentPublicLinkState {
  isEnabled: boolean;
  permission: 'VIEW' | 'EDIT';
  publicToken: string | null;
  expiresAt: string | null;
  hasPassword: boolean;
}

export interface DocumentPublicationState {
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isPublished: boolean;
  publishedAt: string | null;
  version: number;
}

export interface DocumentAccessData {
  currentUserRole: DocumentRoleType;
  isOwner: boolean;
  owner: {
    id: string;
    displayName: string;
    email: string;
  };
  members: DocumentCollaboratorMember[];
  pendingInvitations: DocumentPendingInvitation[];
  publicLink: DocumentPublicLinkState;
  publication: DocumentPublicationState;
}

export interface InvitationDetails {
  type?: 'workspace' | 'document';
  workspaceId?: string;
  redirectUrl?: string;
  workspace?: {
    id: string;
    name: string;
    slug?: string;
    description?: string | null;
  };
  document: {
    id: string;
    title: string;
    icon: string | null;
  };
  inviter: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
  recipientEmail: string;
  role: DocumentRoleType;
  expiresAt: string;
  status: InvitationStatusType;
}

export type TaskStatusType = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export type TaskPriorityType = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type ProjectStatusType = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export type ProjectHealthType = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';

export interface TaskChecklistItemType {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  orderIndex: number;
  createdAt: string;
}

export interface TaskCommentItemType {
  id: string;
  taskId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface TaskBlockerItemType {
  id: string;
  title: string;
  status: TaskStatusType;
  assignee?: { displayName: string } | null;
}

export interface TaskItem {
  id: string;
  workspaceId: string;
  creatorId: string;
  documentId?: string | null;
  projectId?: string | null;
  parentId?: string | null;
  milestoneId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatusType;
  priority: TaskPriorityType;
  dueDate?: string | null;
  startDate?: string | null;
  assigneeId?: string | null;
  orderIndex?: number;
  isArchived?: boolean;
  isBlocked?: boolean;
  blockers?: TaskBlockerItemType[];
  subtaskProgress?: { total: number; done: number; percentage: number };
  checklistProgress?: { total: number; done: number; percentage: number };
  creator?: { id: string; displayName: string; email: string; avatarUrl?: string | null };
  assignee?: { id: string; displayName: string; email: string; avatarUrl?: string | null };
  project?: { id: string; name: string; color?: string; icon?: string };
  document?: { id: string; title: string; icon?: string | null };
  parent?: { id: string; title: string } | null;
  activities?: any[];
  subtasks?: any[];
  checklists?: TaskChecklistItemType[];
  comments?: TaskCommentItemType[];
  repositoryId?: string | null;
  repository?: { id: string; name: string; defaultBranch?: string };
  branchName?: string | null;
  acceptanceCriteria?: Array<{ id: string; text: string; isCompleted: boolean }>;
  claimedById?: string | null;
  claimedBy?: { id: string; displayName: string; email: string };
  claimedAt?: string | null;
  leaseExpiresAt?: string | null;
  isVerified?: boolean;
  verifiedAt?: string | null;
  evidence?: TaskEvidenceItem[];
  labels?: Array<{ label: { id: string; name: string; color: string } }>;
  estimatedHours?: number | null;
  actualHours?: number | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEvidenceItem {
  id: string;
  taskId: string;
  userId: string;
  command: string;
  exitCode: number;
  stdoutSnippet?: string | null;
  stderrSnippet?: string | null;
  commitHash?: string | null;
  branch?: string | null;
  changedFiles?: string[] | null;
  pullRequestUrl?: string | null;
  status: 'PASSED' | 'FAILED';
  executedAt: string;
  createdAt?: string;
  user?: { id: string; displayName: string; email: string };
}

export interface RepositoryItem {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  name: string;
  slug: string;
  gitUrl?: string | null;
  defaultBranch: string;
  localPath?: string | null;
  description?: string | null;
  status?: string;
  isLocalReachable?: boolean;
  uncommittedChangesCount?: number;
  isClean?: boolean;
  liveBranch?: string;
  liveCommit?: any;
  project?: { id: string; name: string; color?: string | null };
  _count?: { tasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface DeveloperTokenItem {
  id: string;
  name: string;
  tokenPrefix?: string;
  workspaceId: string;
  workspace?: { name: string; slug: string };
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface ProjectItem {
  id: string;
  workspaceId: string;
  creatorId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  status: ProjectStatusType;
  health: ProjectHealthType;
  progress: number;
  startDate?: string | null;
  targetDate?: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; displayName: string; email: string };
  members?: Array<{ id: string; user: { id: string; displayName: string; email: string } }>;
  milestones?: Array<{ id: string; title: string; dueDate?: string | null; isCompleted: boolean }>;
  _count?: { tasks: number };
  tasks?: TaskItem[];
  isArchived?: boolean;
}

export interface MyDayData {
  today: TaskItem[];
  overdue: TaskItem[];
  upcoming: TaskItem[];
  completed: TaskItem[];
  waitingOnOthers: TaskItem[];
  stats: {
    todayCount: number;
    overdueCount: number;
    upcomingCount: number;
    completedCount: number;
    blockedCount: number;
  };
}

export interface TerminalExecutionData {
  success: boolean;
  command: string;
  output: string;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  workspaceId: string;
  recipientId: string;
  actorId?: string | null;
  type: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  actor?: { id: string; displayName: string; email: string; avatarUrl?: string | null } | null;
}

export interface FocusSessionItem {
  id: string;
  actualMinutes?: number;
  workspaceId: string;
  userId: string;
  taskId?: string | null;
  title: string;
  targetMinutes: number;
  actualSeconds: number;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  endedAt?: string | null;
  notes?: string | null;
  distractions?: number;
  distractionNotes?: string | null;
  currentElapsedSeconds?: number;
  remainingSeconds?: number;
  isExpired?: boolean;
  task?: { id: string; title: string; priority: string; status: string } | null;
}

export interface TimeEntryItem {
  id: string;
  workspaceId: string;
  userId: string;
  taskId?: string | null;
  projectId?: string | null;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
  description?: string | null;
  isManual: boolean;
  task?: { id: string; title: string } | null;
  project?: { id: string; name: string } | null;
}

export interface KeyResultItem {
  id: string;
  goalId: string;
  title: string;
  description?: string | null;
  type: 'INCREASE' | 'DECREASE' | 'BINARY' | 'MILESTONE';
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  weight: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'AT_RISK';
  ownerId?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  progressPercentage: number;
  rawProgress?: number;
  owner?: { id: string; displayName: string; email: string } | null;
  updates?: Array<{
    id: string;
    previousValue: number;
    newValue: number;
    note?: string | null;
    createdAt: string;
    user: { id: string; displayName: string };
  }>;
}

export interface GoalMetricsData {
  totalGoals: number;
  achievedGoals: number;
  inProgressGoals: number;
  atRiskGoals: number;
  averageProgress: number;
}

export interface GoalItem {
  id: string;
  workspaceId: string;
  creatorId: string;
  ownerId?: string | null;
  title: string;
  description?: string | null;
  category: string;
  timePeriod?: string | null;
  targetValue: number;
  currentValue: number;
  unit: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'AT_RISK' | 'CANCELLED';
  startDate?: string | null;
  targetDate?: string | null;
  projectId?: string | null;
  progressPercentage: number;
  project?: { id: string; name: string; color?: string; progress?: number } | null;
  creator?: { id: string; displayName: string; email: string; avatarUrl?: string | null };
  owner?: { id: string; displayName: string; email: string; avatarUrl?: string | null } | null;
  keyResults?: KeyResultItem[];
  checkIns?: Array<{ id: string; previousValue: number; newValue: number; note?: string; createdAt: string; user?: { id: string; displayName: string } }>;
  createdAt: string;
  updatedAt?: string;
}

export interface AutomationItem {
  id: string;
  workspaceId: string;
  creatorId: string;
  name: string;
  description?: string | null;
  triggerType: string;
  conditions: Array<{ field: string; operator: string; value: any }>;
  actions: Array<{ type: string; params: any }>;
  isEnabled: boolean;
  executionCount: number;
  lastRunAt?: string | null;
  createdAt: string;
  creator?: { id: string; displayName: string };
  executions?: Array<{ id: string; triggerEvent: string; status: string; executedAt: string; durationMs: number; errorMessage?: string }>;
}

export interface DailyCommandCenterData {
  timestamp: string;
  summary: {
    totalOpenTasks: number;
    overdueCount: number;
    dueTodayCount: number;
    blockedCount: number;
    completedTodayCount: number;
    activeProjectsCount: number;
  };
  todayPriorities: TaskItem[];
  dueTodayTasks: TaskItem[];
  overdueTasks: TaskItem[];
  blockedTasks: TaskItem[];
  completedToday: Array<{ id: string; title: string; completedAt: string; priority: string }>;
  activeProjects: Array<{
    id: string;
    name: string;
    color?: string | null;
    health: string;
    progress: number;
    totalTasks: number;
    doneTasks: number;
    remainingTasks: number;
    targetDate?: string | null;
  }>;
  recentNotes: Array<{
    id: string;
    title: string;
    icon?: string | null;
    status: string;
    updatedAt: string;
    snippet: string;
  }>;
  focusTelemetry: {
    activeSession: FocusSessionItem | null;
    todayMinutes: number;
    todayHours: number;
    weekMinutes: number;
    weekHours: number;
  };
  planningAssistant: {
    suggestedPlan: Array<{
      taskId: string;
      title: string;
      priority: string;
      dueDate?: string | null;
      projectName?: string | null;
      rationale: string;
      estimatedMinutes: number;
    }>;
    totalPlannedMinutes: number;
    generatedAt: string;
  };
  reviewSummary: {
    completedTodayCount: number;
    carriedForwardCount: number;
    focusLoggedMinutes: number;
  };
}

export interface WorkspaceAnalyticsData {
  summary: {
    totalTasks: number;
    eligibleTasksCount?: number;
    completedTasks: number;
    completionRate: number;
    tasksWithDueDatesCount?: number;
    overdueCount: number;
    overdueRate: number;
    averageCycleHours: number;
    velocityLast7Days: number;
    velocityPrevious7Days: number;
    velocityTrend: number;
    velocityPercentageChange?: number;
  };
  dailyTrend?: Array<{ date: string; dayName: string; completed: number }>;
  statusDistribution: Record<string, number>;
  priorityDistribution: Record<string, number>;
  projectsHealth: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    total: number;
  };
  projectsExecution?: Array<{
    id: string;
    name: string;
    health: string;
    progress: number;
    totalTasks: number;
    doneTasks: number;
    overdueTasks: number;
  }>;
  goalsMetric: {
    total: number;
    achieved: number;
    averageProgress: number;
  };
}

export const api = new ApiClient(API_BASE_URL);


export type WorkspacePublic = WorkspaceItem;

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt?: string;
  memberCount: number;
  taskCount?: number;
  repoCount?: number;
  projectCount?: number;
  isCurrent?: boolean;
}

export interface WorkspaceMemberItem {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
  isOnline?: boolean;
  lastActiveAt?: string;
  assignedWork?: {
    totalAssigned: number;
    completed: number;
    active: number;
  };
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export interface WorkspaceInvitationItem {
  id: string;
  workspaceId: string;
  inviterId: string;
  recipientEmail: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  message?: string | null;
  expiresAt: string;
  createdAt: string;
  inviteUrl?: string;
  inviter?: {
    displayName: string;
    email: string;
  };
}

export interface WorkspaceActivityItem {
  id: string;
  workspaceId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: any;
  createdAt: string;
  user?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

export interface MentionableUserItem {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
}

export interface ActiveCollaboratorItem {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  workspaceId: string;
  documentId?: string | null;
  joinedAt: string;
  lastSeenAt: string;
}

export interface CollaborationOverviewData {
  workspace: {
    id: string;
    name: string;
    role: string;
  };
  metrics: {
    totalMembers: number;
    pendingInvitations: number;
    activeCollaboratorsCount: number;
    sharedDocumentsCount: number;
    repositoriesCount?: number;
    tasksCount?: number;
    reviewsCount?: number;
  };
  activeCollaborators: ActiveCollaboratorItem[];
  recentActivities: WorkspaceActivityItem[];
}

export interface CodeReviewItem {
  id: string;
  workspaceId: string;
  repositoryId: string;
  taskId?: string | null;
  authorId: string;
  title: string;
  description?: string | null;
  sourceBranch: string;
  targetBranch: string;
  status: 'DRAFT' | 'OPEN' | 'REVIEW_REQUESTED' | 'CHANGES_REQUESTED' | 'APPROVED' | 'MERGED' | 'CLOSED';
  commitHash?: string | null;
  pullRequestUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
  };
  repository: {
    id: string;
    name: string;
    slug: string;
    defaultBranch?: string;
  };
  task?: {
    id: string;
    title: string;
    status: string;
    priority: string;
  } | null;
  _count?: {
    comments: number;
    actions: number;
  };
}

export interface CodeReviewCommentItem {
  id: string;
  reviewId: string;
  userId: string;
  filePath?: string | null;
  lineNumber?: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export interface CodeReviewActionItem {
  id: string;
  reviewId: string;
  userId: string;
  action: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' | 'CLOSE' | 'REOPEN';
  summary?: string | null;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
  };
}

export interface CodeReviewDetail extends CodeReviewItem {
  diff?: string;
  comments: CodeReviewCommentItem[];
  actions: CodeReviewActionItem[];
  task?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    acceptanceCriteria?: any;
    isVerified?: boolean;
  } | null;
}

export interface GitBranchItem {
  name: string;
  isCurrent: boolean;
  commitHash?: string;
  isRemote?: boolean;
  subject?: string;
}

export interface GitCommitItem {
  hash: string;
  shortHash?: string;
  message: string;
  author: string;
  authorName?: string;
  date: string;
  relativeDate?: string;
  matchedTask?: any;
}

export interface GitWorkingTreeStatus {
  branch: string;
  isClean: boolean;
  uncommittedFiles?: string[];
  files?: Array<{ path: string; status: string; staged: boolean }>;
  ahead: number;
  behind: number;
}

export interface RepositoryDetail extends RepositoryItem {
  lastSyncedAt?: string | null;
  branches?: GitBranchItem[];
  commits?: GitCommitItem[];
  statusData?: GitWorkingTreeStatus;
  reviews?: CodeReviewItem[];
  tasks?: any[];
  diff?: string;
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string | null;
}

export interface GitHubActivity {
  owner?: string;
  repo?: string;
  commits: Array<{ message: string; author: string; date: string; sha: string }>;
  pullRequests: Array<{ title: string; number: number; state: string; user: string; url: string }>;
}

export interface ChatChannelItem {
  id: string;
  name: string;
  description: string;
  topic?: string;
  isPrivate?: boolean;
  isArchived?: boolean;
  createdById?: string | null;
  messageCount: number;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    author: string;
  } | null;
}

export interface ChatMessageItem {
  id: string;
  workspaceId: string;
  userId: string;
  channel: string;
  channelId?: string | null;
  replyToId?: string | null;
  content: string;
  attachments?: any;
  reactions?: Record<string, string[]>;
  pinned: boolean;
  isEdited?: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
  };
  replyTo?: {
    id: string;
    content: string;
    user: { displayName: string };
  } | null;
}

export interface CanvasItem {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  description?: string | null;
  data: {
    nodes: Array<{ id: string; type: string; title: string; description?: string; x: number; y: number; color?: string; icon?: string }>;
    connections: Array<{ from: string; to: string; label?: string }>;
    notes: Array<{ id: string; text: string; x: number; y: number; color?: string }>;
  };
  thumbnail?: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string | null;
  };
}
