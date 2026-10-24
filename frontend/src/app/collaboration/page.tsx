'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/app-shell';
import {
  api,
  API_BASE_URL,
  WorkspaceItem,
  WorkspaceMemberItem,
  WorkspaceInvitationItem,
  WorkspaceActivityItem,
  ActiveCollaboratorItem,
  CollaborationOverviewData,
} from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Crown,
  Eye,
  Mail,
  Send,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Activity,
  Layers,
  FolderGit2,
  CheckSquare,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  X,
  ExternalLink,
  Plus,
  Radio,
  Settings,
} from 'lucide-react';

export default function CollaborationPage() {
  // Workspaces state
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  // Edit Workspace state
  const [isEditWorkspaceModalOpen, setIsEditWorkspaceModalOpen] = useState(false);
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [editWorkspaceDesc, setEditWorkspaceDesc] = useState('');
  const [isUpdatingWorkspace, setIsUpdatingWorkspace] = useState(false);

  // Collaboration data
  const [overview, setOverview] = useState<CollaborationOverviewData | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<WorkspaceInvitationItem[]>([]);
  const [activities, setActivities] = useState<WorkspaceActivityItem[]>([]);
  const [activeCollaborators, setActiveCollaborators] = useState<ActiveCollaboratorItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtering & search
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'activity'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Invite modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Role edit / delete action state
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Current user's role in active workspace
  const currentWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  const canManageMembers = currentWorkspace?.role === 'OWNER' || currentWorkspace?.role === 'ADMIN';

  // Load user workspaces
  const loadWorkspaces = async () => {
    try {
      const res = await api.listWorkspaces();
      if (res.success && res.data?.workspaces) {
        setWorkspaces(res.data.workspaces);
        const storedId = api.getActiveWorkspaceId();
        const matched = storedId ? res.data.workspaces.find((w: any) => w.id === storedId) : null;
        const active = matched || res.data.workspaces.find((w: any) => w.isCurrent) || res.data.workspaces[0];
        if (active) {
          setActiveWorkspaceId(active.id);
          api.setActiveWorkspaceId(active.id);
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  };

  useEffect(() => {
    const handleWsChange = (e: any) => {
      const newWsId = e.detail?.workspaceId;
      if (newWsId) {
        setActiveWorkspaceId(newWsId);
      }
    };
    window.addEventListener('kronos:workspace-changed', handleWsChange);
    return () => window.removeEventListener('kronos:workspace-changed', handleWsChange);
  }, []);

  // Load workspace collaboration data
  const loadCollaborationData = async (wsId?: string) => {
    const targetWsId = wsId || activeWorkspaceId;
    if (!targetWsId) return;

    setLoading(true);
    setActionError(null);
    try {
      const [overviewRes, membersRes, invitesRes, activityRes] = await Promise.all([
        typeof api.getCollaborationOverview === 'function'
          ? api.getCollaborationOverview(targetWsId)
          : (api as any).request(`/api/collaboration/overview?workspaceId=${encodeURIComponent(targetWsId)}`),
        typeof api.listWorkspaceMembers === 'function'
          ? api.listWorkspaceMembers({ workspaceId: targetWsId, limit: 100 })
          : (api as any).request(`/api/collaboration/members?workspaceId=${encodeURIComponent(targetWsId)}&limit=100`),
        typeof api.listPendingInvitations === 'function'
          ? api.listPendingInvitations(targetWsId)
          : (api as any).request(`/api/collaboration/invitations/pending?workspaceId=${encodeURIComponent(targetWsId)}`),
        typeof api.getWorkspaceActivity === 'function'
          ? api.getWorkspaceActivity({ workspaceId: targetWsId, limit: 50 })
          : (api as any).request(`/api/collaboration/activity?workspaceId=${encodeURIComponent(targetWsId)}&limit=50`),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
        if (overviewRes.data.activeCollaborators) {
          setActiveCollaborators(overviewRes.data.activeCollaborators);
        }
      }

      if (membersRes.success && membersRes.data?.members) {
        setMembers(membersRes.data.members);
      }

      if (invitesRes.success && invitesRes.data?.invitations) {
        setPendingInvitations(invitesRes.data.invitations);
      }

      if (activityRes.success && activityRes.data?.activities) {
        setActivities(activityRes.data.activities);
      }
    } catch (err) {
      console.error('Failed to load collaboration data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      loadCollaborationData(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  // Presence Heartbeat & Realtime SSE Listener
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const sendHeartbeat = () => {
      if (typeof api.sendPresenceHeartbeat === 'function') {
        return api.sendPresenceHeartbeat({ workspaceId: activeWorkspaceId });
      }
      return (api as any).request('/api/collaboration/presence/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: activeWorkspaceId }),
      });
    };

    // Send initial presence heartbeat
    sendHeartbeat().catch(() => {});

    // Periodic heartbeat every 25 seconds
    const heartbeatTimer = setInterval(() => {
      sendHeartbeat().then((res: any) => {
        if (res.success && res.data?.activeCollaborators) {
          setActiveCollaborators(res.data.activeCollaborators);
        }
      }).catch(() => {});
    }, 25000);

    // Realtime SSE event listener
    const eventSource = new EventSource(`${API_BASE_URL}/api/collaboration/realtime?workspaceId=${activeWorkspaceId}`, {
      withCredentials: true,
    });

    eventSource.onerror = () => {
      // Graceful error suppression during HMR dev reloads
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'PRESENCE_UPDATED' && payload.data?.activeCollaborators) {
          setActiveCollaborators(payload.data.activeCollaborators);
        } else if (
          payload.type === 'MEMBER_JOINED' ||
          payload.type === 'MEMBER_ROLE_UPDATED' ||
          payload.type === 'MEMBER_REMOVED' ||
          payload.type === 'CODE_REVIEW_CREATED' ||
          payload.type === 'CODE_REVIEW_ACTION_RECORDED'
        ) {
          // Refresh background data
          loadCollaborationData(activeWorkspaceId);
        }
      } catch {
        // Ignored
      }
    };

    return () => {
      clearInterval(heartbeatTimer);
      eventSource.close();
    };
  }, [activeWorkspaceId]);

  // Create Workspace
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setIsCreatingWorkspace(true);
    try {
      const res = await api.createWorkspace({
        name: newWorkspaceName.trim(),
        description: newWorkspaceDesc.trim() || undefined,
      });

      if (res.success && res.data?.workspace) {
        setIsNewWorkspaceModalOpen(false);
        setNewWorkspaceName('');
        setNewWorkspaceDesc('');
        await loadWorkspaces();
        setActiveWorkspaceId(res.data.workspace.id);
      }
    } catch (err) {
      console.error('Failed to create workspace:', err);
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  // Open Edit Workspace Modal
  const handleOpenEditWorkspace = () => {
    if (!currentWorkspace) return;
    setEditWorkspaceName(currentWorkspace.name);
    setEditWorkspaceDesc(currentWorkspace.description || '');
    setIsEditWorkspaceModalOpen(true);
  };

  // Update Workspace
  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !editWorkspaceName.trim()) return;

    setIsUpdatingWorkspace(true);
    try {
      const res = await api.updateWorkspace(activeWorkspaceId, {
        name: editWorkspaceName.trim(),
        description: editWorkspaceDesc.trim() || undefined,
      });

      if (res.success && res.data?.workspace) {
        setIsEditWorkspaceModalOpen(false);
        setActionSuccess(`Workspace updated to "${res.data.workspace.name}"`);
        setTimeout(() => setActionSuccess(null), 3000);
        await loadWorkspaces();
        await loadCollaborationData(activeWorkspaceId);
      } else {
        setActionError(res.error?.message || 'Failed to update workspace');
        setTimeout(() => setActionError(null), 4000);
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error updating workspace');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsUpdatingWorkspace(false);
    }
  };

  // Send Invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsSendingInvite(true);
    setInviteError(null);
    setLastInviteLink(null);

    try {
      const res = await api.inviteWorkspaceMember({
        recipientEmail: inviteEmail.trim(),
        role: inviteRole,
        message: inviteMessage.trim() || undefined,
        workspaceId: activeWorkspaceId,
      });

      if (res.success && res.data) {
        let generatedLink = res.data.invitation.inviteUrl || null;
        if (generatedLink && typeof window !== 'undefined') {
          try {
            const urlObj = new URL(generatedLink);
            urlObj.protocol = window.location.protocol;
            urlObj.host = window.location.host;
            generatedLink = urlObj.toString();
          } catch {}
        }
        setInviteEmail('');
        setInviteMessage('');
        setLastInviteLink(generatedLink);
        setActionSuccess(`Invitation registered for ${res.data.invitation.recipientEmail}`);
        setTimeout(() => setActionSuccess(null), 4000);
        await loadCollaborationData();
      } else {
        setInviteError(res.error?.message || 'Failed to send invitation');
      }
    } catch (err: any) {
      setInviteError(err.message || 'Network error sending invitation');
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Resend invitation
  const handleResendInvite = async (invitationId: string) => {
    try {
      const res = await api.resendWorkspaceInvitation(invitationId);
      if (res.success) {
        let link = res.data?.inviteUrl;
        if (link && typeof window !== 'undefined') {
          try {
            const u = new URL(link);
            u.protocol = window.location.protocol;
            u.host = window.location.host;
            link = u.toString();
          } catch {}
          setLastInviteLink(link);
          setIsInviteModalOpen(true);
        }
        setActionSuccess('Invitation refreshed & direct link ready.');
        setTimeout(() => setActionSuccess(null), 4000);
        await loadCollaborationData();
      } else {
        setActionError(res.error?.message || 'Failed to resend invitation');
        setTimeout(() => setActionError(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to resend invite:', err);
      setActionError(err?.message || 'Network error resending invite');
      setTimeout(() => setActionError(null), 4000);
    }
  };

  // Revoke invitation
  const handleRevokeInvite = async (invitationId: string) => {
    if (!confirm('Are you sure you want to revoke this pending invitation?')) return;
    try {
      const res = await api.revokeWorkspaceInvitation(invitationId);
      if (res.success) {
        setActionSuccess('Invitation revoked.');
        setTimeout(() => setActionSuccess(null), 3000);
        await loadCollaborationData();
      }
    } catch (err) {
      console.error('Failed to revoke invite:', err);
    }
  };

  // Change member role
  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const res = await api.updateWorkspaceMemberRole(memberId, newRole);
      if (res.success) {
        setActionSuccess('Member role updated.');
        setTimeout(() => setActionSuccess(null), 3000);
        await loadCollaborationData();
      } else {
        setActionError(res.error?.message || 'Failed to update member role');
        setTimeout(() => setActionError(null), 4000);
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error');
      setTimeout(() => setActionError(null), 4000);
    }
  };

  // Remove member
  const handleRemoveMember = async (memberId: string, displayName: string) => {
    if (!confirm(`Are you sure you want to remove "${displayName}" from this workspace?`)) return;
    try {
      const res = await api.removeWorkspaceMember(memberId);
      if (res.success) {
        setActionSuccess(`Removed ${displayName} from workspace.`);
        setTimeout(() => setActionSuccess(null), 3000);
        await loadCollaborationData();
      } else {
        setActionError(res.error?.message || 'Failed to remove member');
        setTimeout(() => setActionError(null), 4000);
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error');
      setTimeout(() => setActionError(null), 4000);
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const name = (m.user?.displayName || (m as any).displayName || '').toLowerCase();
      const email = (m.user?.email || (m as any).email || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = name.includes(q) || email.includes(q);
      const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-3.5 h-3.5 text-zinc-100" />;
      case 'ADMIN':
        return <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />;
      case 'MEMBER':
        return <Users className="w-3.5 h-3.5 text-zinc-400" />;
      default:
        return <Eye className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  return (
    <AppShell headerTitle="TEAM COLLABORATION" headerSubtitle="Multiplayer developer workspace, shared teams, and real-time sync">
      <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans text-zinc-100">

        {/* Top Control Bar & Workspace Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111216] border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
                className="flex items-center gap-3 bg-[#181920] hover:bg-zinc-800/70 border border-zinc-700/60 rounded-lg px-3.5 py-2 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-200">
                  {currentWorkspace?.name ? currentWorkspace.name.slice(0, 2).toUpperCase() : 'WS'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{currentWorkspace?.name || 'Workspace'}</span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 border-zinc-700 text-zinc-400">
                      {currentWorkspace?.role || 'MEMBER'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {currentWorkspace?.memberCount ?? members.length} member(s) enrolled
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-zinc-500 ml-2" />
              </button>

              {/* Workspace Switcher Dropdown */}
              {isWorkspaceMenuOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-[#181920] border border-zinc-700/80 rounded-xl shadow-2xl py-2 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-mono tracking-wider text-zinc-500 uppercase">
                    Your Authorized Workspaces
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800/40">
                    {workspaces.map((ws) => (
                      <button
                        key={ws.id}
                        onClick={() => {
                          setActiveWorkspaceId(ws.id);
                          setIsWorkspaceMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-800/60 text-xs transition-colors ${
                          ws.id === activeWorkspaceId ? 'bg-zinc-800/40 text-white font-medium' : 'text-zinc-300'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate font-medium">{ws.name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{ws.role}</div>
                        </div>
                        {ws.id === activeWorkspaceId && <Check className="w-4 h-4 text-zinc-300 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 border-t border-zinc-800 mt-1">
                    <button
                      onClick={() => {
                        setIsWorkspaceMenuOpen(false);
                        setIsNewWorkspaceModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800/70 hover:bg-zinc-700/70 rounded-md transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create New Workspace
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Workspace Settings Button */}
            {canManageMembers && (
              <button
                onClick={handleOpenEditWorkspace}
                className="p-2.5 bg-[#181920] border border-zinc-700/60 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center justify-center shrink-0"
                title="Workspace Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Live Presence indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#181920] border border-zinc-800 rounded-lg text-xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-zinc-300 font-mono text-[11px]">
                {activeCollaborators.length > 0
                  ? `${activeCollaborators.length} Online Now`
                  : 'Live Synced'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadCollaborationData()}
              className="border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canManageMembers && (
              <Button
                size="sm"
                onClick={() => setIsInviteModalOpen(true)}
                className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs gap-1.5 shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite Teammate
              </Button>
            )}
          </div>
        </div>

        {/* Action feedback banners */}
        {actionSuccess && (
          <div className="flex items-center gap-2 p-3 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-200 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-900/80 rounded-lg text-xs text-red-200 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#111216] border border-zinc-800/80 rounded-xl p-4">
            <div className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase flex items-center justify-between">
              Total Enrolled
              <Users className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold mt-1 text-white">{members.length}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Active Workspace Members</div>
          </div>

          <div className="bg-[#111216] border border-zinc-800/80 rounded-xl p-4">
            <div className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase flex items-center justify-between">
              Pending Invites
              <Mail className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold mt-1 text-white">{pendingInvitations.length}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Awaiting Acceptance</div>
          </div>

          <div className="bg-[#111216] border border-zinc-800/80 rounded-xl p-4">
            <div className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase flex items-center justify-between">
              Active Now
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold mt-1 text-white">{Math.max(1, activeCollaborators.length)}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Connected in Session</div>
          </div>

          <div className="bg-[#111216] border border-zinc-800/80 rounded-xl p-4">
            <div className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase flex items-center justify-between">
              Activities Logged
              <Activity className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold mt-1 text-white">{activities.length}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Collaborative Events</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 relative transition-colors ${
              activeTab === 'members' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Team Members ({members.length})
            {activeTab === 'members' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`pb-3 relative transition-colors flex items-center gap-1.5 ${
              activeTab === 'invitations' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Pending Invitations
            {pendingInvitations.length > 0 && (
              <span className="px-1.5 py-0.2 bg-zinc-800 text-[10px] rounded-full text-zinc-300">
                {pendingInvitations.length}
              </span>
            )}
            {activeTab === 'invitations' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-3 relative transition-colors ${
              activeTab === 'activity' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Workspace Activity
            {activeTab === 'activity' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
            )}
          </button>
        </div>

        {/* TAB 1: MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search members by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#111216] border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-zinc-400">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <span>Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-[#111216] border border-zinc-800 text-zinc-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-zinc-600"
                >
                  <option value="ALL">All Roles</option>
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
            </div>

            {/* Members Table */}
            <div className="bg-[#111216] border border-zinc-800/80 rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-[#16171d]/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                    <th className="py-3 px-4">Collaborator</th>
                    <th className="py-3 px-4">Role & Access</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Assigned Work</th>
                    <th className="py-3 px-4 hidden md:table-cell">Joined</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {filteredMembers.map((member) => {
                    const isOnline = activeCollaborators.some((c) => c.userId === member.userId);
                    return (
                      <tr key={member.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-200">
                                {((member.user?.displayName || (member as any).displayName || 'U'))[0]?.toUpperCase() || 'U'}
                              </div>
                              {isOnline && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#111216] rounded-full" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-white flex items-center gap-1.5">
                                {member.user?.displayName || (member as any).displayName || 'Member'}
                                {isOnline && (
                                  <span className="text-[10px] font-mono text-emerald-400">online</span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-400 font-mono">{member.user?.email || (member as any).email || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-300 text-[11px]">
                            {getRoleIcon(member.role)}
                            <span>{member.role}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell font-mono text-[11px]">
                          {member.assignedWork && member.assignedWork.totalAssigned > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 text-[10px]">
                                {member.assignedWork.active} active
                              </span>
                              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px]">
                                {member.assignedWork.completed} done
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-600 text-[11px]">No tasks</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400 hidden md:table-cell font-mono text-[11px]">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {canManageMembers && member.role !== 'OWNER' ? (
                            <div className="flex items-center justify-end gap-2">
                              <select
                                value={member.role}
                                onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                                className="bg-[#181920] border border-zinc-700/80 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-500"
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="MEMBER">MEMBER</option>
                                <option value="VIEWER">VIEWER</option>
                              </select>
                              <button
                                onClick={() => handleRemoveMember(member.id, member.user?.displayName || (member as any).displayName || 'member')}
                                className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-800/80 transition-colors"
                                title="Remove Member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-500 font-mono">Protected</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500">
                        No team members found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PENDING INVITATIONS */}
        {activeTab === 'invitations' && (
          <div className="bg-[#111216] border border-zinc-800/80 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-[#16171d]/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                  <th className="py-3 px-4">Invited Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {pendingInvitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-zinc-200">
                      {inv.recipientEmail}
                      {inv.message && (
                        <div className="text-[11px] text-zinc-500 font-sans mt-0.5 truncate max-w-xs">
                          "{inv.message}"
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="secondary" className="border-zinc-700 text-zinc-300 text-[10px]">
                        {inv.role}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendInvite(inv.id)}
                          className="h-7 text-[11px] border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white"
                        >
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="h-7 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/40"
                        >
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingInvitations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-zinc-500">
                      No pending invitations. Click "Invite Teammate" to expand your workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: WORKSPACE ACTIVITY */}
        {activeTab === 'activity' && (
          <div className="bg-[#111216] border border-zinc-800/80 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-xs font-mono tracking-wider text-zinc-400 uppercase">
                Chronological Audit Stream
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">{activities.length} recorded events</span>
            </div>
            <div className="space-y-3">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start gap-3 p-3 bg-[#181920]/60 border border-zinc-800/80 rounded-lg hover:border-zinc-700 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0 mt-0.5">
                    {act.user?.displayName ? act.user.displayName[0].toUpperCase() : 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-200">
                      <span className="font-semibold text-white">{act.user?.displayName || 'System'}</span>{' '}
                      <span className="text-zinc-400 font-mono text-[11px]">
                        {act.action.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </div>
                    {act.metadata?.title && (
                      <div className="text-[11px] text-zinc-300 font-medium truncate mt-0.5">
                        "{act.metadata.title}"
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                    {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  No activity recorded yet in this workspace.
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: Invite Teammate */}
        {isInviteModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#121318] border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-white" />
                  <h3 className="font-semibold text-sm text-white">Invite Teammate to Workspace</h3>
                </div>
                <button
                  onClick={() => setIsInviteModalOpen(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {inviteError && (
                <div className="p-3 bg-red-950/40 border border-red-900 rounded-lg text-xs text-red-200">
                  {inviteError}
                </div>
              )}

              {lastInviteLink ? (
                <div className="space-y-4">
                  <div className="p-4 bg-[#181920] border border-zinc-800 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Invitation Registered in Workspace Database</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      If email delivery is unconfigured or blocked by a firewall, share this direct single-purpose cryptographic invitation link with your teammate:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={lastInviteLink}
                        className="w-full bg-[#111216] border border-zinc-700/80 rounded px-2.5 py-1.5 text-xs text-zinc-300 font-mono select-all focus:outline-none focus:border-zinc-500"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(lastInviteLink);
                          setCopiedInvite(true);
                          setTimeout(() => setCopiedInvite(false), 2500);
                        }}
                        className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs gap-1 shrink-0"
                      >
                        {copiedInvite ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </Button>
                      <a
                        href={lastInviteLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shrink-0 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Link
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLastInviteLink(null)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Invite Another
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setLastInviteLink(null);
                        setIsInviteModalOpen(false);
                      }}
                      className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                      Teammate Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="developer@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                      Workspace Role *
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                    >
                      <option value="ADMIN">ADMIN — Full project and member management</option>
                      <option value="MEMBER">MEMBER — Create tasks, connect repos, submit reviews</option>
                      <option value="VIEWER">VIEWER — Read-only telemetry and task inspection</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                      Custom Note (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Join our engineering team on Project Atlas..."
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSendingInvite || !inviteEmail.trim()}
                      className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs gap-1.5"
                    >
                      {isSendingInvite ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Send Official Invitation
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* MODAL: Create New Workspace */}
        {isNewWorkspaceModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#121318] border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-white" />
                  <h3 className="font-semibold text-sm text-white">Create New Workspace</h3>
                </div>
                <button
                  onClick={() => setIsNewWorkspaceModalOpen(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                    Workspace Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Core Engineering"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Shared developer workspace for team microservices"
                    value={newWorkspaceDesc}
                    onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                    className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsNewWorkspaceModalOpen(false)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isCreatingWorkspace || !newWorkspaceName.trim()}
                    className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs gap-1.5"
                  >
                    {isCreatingWorkspace ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Initialize Workspace
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Edit Workspace Settings */}
        {isEditWorkspaceModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#121318] border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-white" />
                  <h3 className="font-semibold text-sm text-white">Workspace Settings</h3>
                </div>
                <button
                  onClick={() => setIsEditWorkspaceModalOpen(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                    Workspace Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Workspace name..."
                    value={editWorkspaceName}
                    onChange={(e) => setEditWorkspaceName(e.target.value)}
                    className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-wider text-zinc-400 uppercase mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Workspace purpose and team goals..."
                    value={editWorkspaceDesc}
                    onChange={(e) => setEditWorkspaceDesc(e.target.value)}
                    className="w-full bg-[#181920] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditWorkspaceModalOpen(false)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUpdatingWorkspace || !editWorkspaceName.trim()}
                    className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs gap-1.5"
                  >
                    {isUpdatingWorkspace ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save Settings
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
