// Frontend API client for communicating with the backend
import type { ApiResponse } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include', // Always send cookies
        headers: {
          'Content-Type': 'application/json',
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
      message: string;
    }>(`/api/documents/${documentId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendInvitation(documentId: string, invitationId: string) {
    return this.request<{ invitation: any; message: string }>(
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
    return this.request<{ documentId: string; documentTitle: string; role: DocumentRoleType; message: string }>(
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

  async bulkTasks(taskIds: string[], action: 'complete' | 'reopen' | 'delete' | 'archive' | 'status' | 'priority', data?: any) {
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

  async addTaskComment(taskId: string, content: string) {
    return this.request<{ comment: TaskCommentItemType }>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // ─── Projects API ──────────────────────────────────────────────────────────

  async getProjects(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request<{ projects: ProjectItem[] }>(`/api/projects${query}`);
  }

  async getProject(id: string) {
    return this.request<{ project: ProjectItem }>(`/api/projects/${id}`);
  }

  async createProject(data: {
    name: string;
    description?: string;
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

  async updateMilestone(projectId: string, milestoneId: string, data: { isCompleted?: boolean; title?: string; targetDate?: string }) {
    return this.request<{ milestone: any }>(`/api/projects/${projectId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
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
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserPublic {
  id: string;
  email: string;
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
  subtasks?: any[];
  checklists?: TaskChecklistItemType[];
  comments?: TaskCommentItemType[];
  createdAt: string;
  updatedAt: string;
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

export const api = new ApiClient(API_BASE_URL);



