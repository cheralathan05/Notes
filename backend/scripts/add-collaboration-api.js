const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'api.ts');
let content = fs.readFileSync(apiPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Update UserPublic to include emailNormalized
content = content.replace(
  '  avatarUrl: string | null;\n  createdAt: string;\n}',
  '  avatarUrl: string | null;\n  emailNormalized?: string;\n  createdAt: string;\n}'
);

// 2. Update FocusSessionItem to include actualMinutes
content = content.replace(
  '  targetMinutes: number;\n  actualSeconds: number;',
  '  targetMinutes: number;\n  actualSeconds: number;\n  actualMinutes?: number;'
);

// 3. Update InvitationDetails
content = content.replace(
  'export interface InvitationDetails {',
  `export interface InvitationDetails {
  type?: 'workspace' | 'document';
  workspaceId?: string;
  redirectUrl?: string;
  workspace?: {
    id: string;
    name: string;
    slug?: string;
    description?: string | null;
  };`
);

// 4. Update getProjects to handle both string status and object query options
content = content.replace(
  `  async getProjects(status?: string) {
    const query = status ? \`?status=\${status}\` : '';
    return this.request<{ projects: ProjectItem[] }>(\`/api/projects\${query}\`);
  }`,
  `  async getProjects(statusOrOptions?: string | { search?: string; status?: string; includeArchived?: boolean; sortBy?: string; sortOrder?: string; workspaceId?: string }) {
    let query = '';
    if (typeof statusOrOptions === 'string') {
      query = statusOrOptions ? \`?status=\${statusOrOptions}\` : '';
    } else if (statusOrOptions && typeof statusOrOptions === 'object') {
      const p = new URLSearchParams();
      if (statusOrOptions.search) p.set('search', statusOrOptions.search);
      if (statusOrOptions.status) p.set('status', statusOrOptions.status);
      if (statusOrOptions.includeArchived) p.set('includeArchived', 'true');
      if (statusOrOptions.sortBy) p.set('sortBy', statusOrOptions.sortBy);
      if (statusOrOptions.sortOrder) p.set('sortOrder', statusOrOptions.sortOrder);
      if (statusOrOptions.workspaceId) p.set('workspaceId', statusOrOptions.workspaceId);
      const str = p.toString();
      query = str ? \`?\${str}\` : '';
    }
    return this.request<{ projects: ProjectItem[] }>(\`/api/projects\${query}\`);
  }`
);

// 5. Update createProject to accept color
content = content.replace(
  `  async createProject(data: {
    name: string;
    description?: string;
    startDate?: string;
    targetDate?: string;
  }) {`,
  `  async createProject(data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    startDate?: string;
    targetDate?: string;
  }) {`
);

// 6. Add collaboration & chat methods to ApiClient
const collabMethods = `
  // ─── Collaboration Extended ───────────────────────────────────────────────
  async getCollaborationOverview(workspaceId?: string) {
    const qs = workspaceId ? \`?workspaceId=\${workspaceId}\` : '';
    return this.request<any>(\`/api/collaboration/overview\${qs}\`);
  }

  async listWorkspaceMembers(workspaceId?: string) {
    const qs = workspaceId ? \`?workspaceId=\${workspaceId}\` : '';
    return this.request<any>(\`/api/collaboration/members\${qs}\`);
  }

  async listPendingInvitations(workspaceId?: string) {
    const qs = workspaceId ? \`?workspaceId=\${workspaceId}\` : '';
    return this.request<any>(\`/api/collaboration/invitations\${qs}\`);
  }

  async getWorkspaceActivity(workspaceId?: string) {
    const qs = workspaceId ? \`?workspaceId=\${workspaceId}\` : '';
    return this.request<any>(\`/api/collaboration/activity\${qs}\`);
  }

  async sendPresenceHeartbeat(workspaceId: string, status?: string) {
    return this.request<any>('/api/collaboration/presence', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, status }),
    });
  }

  async updateWorkspace(id: string, data: any) {
    return this.request<any>(\`/api/collaboration/workspaces/\${id}\`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async inviteWorkspaceMember(data: any) {
    return this.request<any>('/api/collaboration/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendWorkspaceInvitation(id: string) {
    return this.request<any>(\`/api/collaboration/invitations/\${id}/resend\`, {
      method: 'POST',
    });
  }

  async revokeWorkspaceInvitation(id: string) {
    return this.request<any>(\`/api/collaboration/invitations/\${id}/revoke\`, {
      method: 'POST',
    });
  }

  async updateWorkspaceMemberRole(workspaceId: string, memberId: string, role: string) {
    return this.request<any>(\`/api/collaboration/workspaces/\${workspaceId}/members/\${memberId}\`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removeWorkspaceMember(workspaceId: string, memberId: string) {
    return this.request<any>(\`/api/collaboration/workspaces/\${workspaceId}/members/\${memberId}\`, {
      method: 'DELETE',
    });
  }

  async archiveProject(id: string) {
    return this.request<any>(\`/api/projects/\${id}/archive\`, {
      method: 'POST',
    });
  }

  async unarchiveProject(id: string) {
    return this.request<any>(\`/api/projects/\${id}/unarchive\`, {
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
    return this.request<any>(\`/api/chat/messages\${qs ? \`?\${qs}\` : ''}\`);
  }

  async sendChatMessage(data: any) {
    return this.request<any>('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleChatReaction(messageId: string, emoji: string) {
    return this.request<any>(\`/api/chat/messages/\${messageId}/reactions\`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  async toggleChatPin(messageId: string) {
    return this.request<any>(\`/api/chat/messages/\${messageId}/pin\`, {
      method: 'PATCH',
    });
  }

  async deleteChatMessage(messageId: string) {
    return this.request<any>(\`/api/chat/messages/\${messageId}\`, {
      method: 'DELETE',
    });
  }
`;

content = content.replace(
  '  async deleteCanvas(id: string) {',
  collabMethods + '\n  async deleteCanvas(id: string) {'
);

fs.writeFileSync(apiPath, content, 'utf8');
console.log('Successfully updated api.ts with collaboration & chat API');
