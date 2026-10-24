'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2,
  Globe,
  Lock,
  Copy,
  Check,
  X,
  Shield,
  Eye,
  Edit3,
  MessageSquare,
  UserPlus,
  Trash2,
  RefreshCw,
  Mail,
  ChevronDown,
  Key,
  Calendar,
  AlertCircle,
  FileCheck,
  ExternalLink,
} from 'lucide-react';
import {
  api,
  DocumentAccessData,
  DocumentRoleType,
  DocumentCollaboratorMember,
  DocumentPendingInvitation,
} from '@/lib/api';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle?: string;
}

export function ShareModal({ isOpen, onClose, documentId, documentTitle }: ShareModalProps) {
  const [loading, setLoading] = useState(true);
  const [accessData, setAccessData] = useState<DocumentAccessData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS' | 'ERROR'>('IDLE');

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<DocumentRoleType>('VIEWER');
  const [inviteMessage, setInviteMessage] = useState('');
  const [showInviteMessage, setShowInviteMessage] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Public link configuration state
  const [copiedLink, setCopiedLink] = useState(false);
  const [publicPassword, setPublicPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [publicExpiryDays, setPublicExpiryDays] = useState<number | null>(null);

  // Publishing state
  const [publishProcessing, setPublishProcessing] = useState(false);

  // Active tab inside modal for ultra-clean monochrome organization
  const [activeTab, setActiveTab] = useState<'INVITE' | 'PUBLIC' | 'PUBLISH'>('INVITE');

  // Load access settings from backend
  const loadAccessData = useCallback(async () => {
    try {
      setSyncStatus('SAVING');
      const res = await api.getDocumentAccess(documentId);
      if (res.success && res.data) {
        setAccessData(res.data);
        setError(null);
        setSyncStatus('SUCCESS');
      } else {
        setError(res.error?.message || 'Failed to retrieve access configuration');
        setSyncStatus('ERROR');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error retrieving access state');
      setSyncStatus('ERROR');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setInviteFeedback(null);
      setError(null);
      loadAccessData();
    }
  }, [isOpen, loadAccessData]);

  // Invite a new collaborator
  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInviteFeedback({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    if (accessData?.owner && cleanEmail === accessData.owner.email.toLowerCase()) {
      setInviteFeedback({
        type: 'error',
        text: 'You cannot invite yourself (you are already the document owner)',
      });
      return;
    }

    setInviteSending(true);
    setInviteFeedback(null);
    try {
      const res = await api.inviteCollaborator(documentId, {
        recipientEmail: cleanEmail,
        role: inviteRole,
        message: inviteMessage.trim() || undefined,
      });

      if (res.success) {
        setInviteEmail('');
        setInviteMessage('');
        setShowInviteMessage(false);
        const isDelivered = res.data?.emailSent !== false;
        setInviteFeedback({
          type: isDelivered ? 'success' : 'error',
          text: res.data?.message || (isDelivered ? `Invitation dispatched to ${cleanEmail}` : 'Invitation created but email delivery failed'),
        });
        await loadAccessData();
      } else {
        setInviteFeedback({
          type: 'error',
          text: res.error?.message || 'Failed to dispatch invitation',
        });
      }
    } catch (err: any) {
      setInviteFeedback({
        type: 'error',
        text: err?.message || 'Network error sending invitation',
      });
    } finally {
      setInviteSending(false);
    }
  };

  // Change collaborator role
  const handleUpdateRole = async (memberUserId: string, newRole: DocumentRoleType) => {
    try {
      setSyncStatus('SAVING');
      const res = await api.updateCollaboratorRole(documentId, memberUserId, newRole);
      if (res.success) {
        setSyncStatus('SUCCESS');
        await loadAccessData();
      } else {
        setError(res.error?.message || 'Failed to update member permission');
        setSyncStatus('ERROR');
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating permission');
      setSyncStatus('ERROR');
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (memberUserId: string, displayName: string) => {
    if (!window.confirm(`Revoke document access for ${displayName}?`)) return;
    try {
      setSyncStatus('SAVING');
      const res = await api.removeCollaborator(documentId, memberUserId);
      if (res.success) {
        setSyncStatus('SUCCESS');
        await loadAccessData();
      } else {
        setError(res.error?.message || 'Failed to remove collaborator');
        setSyncStatus('ERROR');
      }
    } catch (err: any) {
      setError(err?.message || 'Error removing collaborator');
      setSyncStatus('ERROR');
    }
  };

  // Resend invitation
  const handleResendInvitation = async (invitationId: string, email: string) => {
    try {
      setSyncStatus('SAVING');
      const res = await api.resendInvitation(documentId, invitationId);
      if (res.success) {
        const isDelivered = res.data?.emailSent !== false;
        setInviteFeedback({
          type: isDelivered ? 'success' : 'error',
          text: res.data?.message || (isDelivered ? `Invitation re-dispatched to ${email}` : 'Token refreshed, but email delivery failed'),
        });
        setSyncStatus('SUCCESS');
        await loadAccessData();
      } else {
        setError(res.error?.message || 'Failed to resend invitation');
        setSyncStatus('ERROR');
      }
    } catch (err: any) {
      setError(err?.message || 'Error resending invitation');
      setSyncStatus('ERROR');
    }
  };

  // Revoke invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      setSyncStatus('SAVING');
      const res = await api.revokeInvitation(documentId, invitationId);
      if (res.success) {
        setSyncStatus('SUCCESS');
        await loadAccessData();
      } else {
        setError(res.error?.message || 'Failed to revoke invitation');
        setSyncStatus('ERROR');
      }
    } catch (err: any) {
      setError(err?.message || 'Error revoking invitation');
      setSyncStatus('ERROR');
    }
  };

  // Public link toggle
  const handleTogglePublicLink = async () => {
    if (!accessData) return;
    const nextState = !accessData.publicLink.isEnabled;
    try {
      setSyncStatus('SAVING');
      const res = await api.configurePublicLink(documentId, {
        isEnabled: nextState,
        permission: accessData.publicLink.permission,
      });
      if (res.success) {
        setSyncStatus('SUCCESS');
        await loadAccessData();
      } else {
        setError(res.error?.message || 'Failed to update public link');
        setSyncStatus('ERROR');
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating public link');
      setSyncStatus('ERROR');
    }
  };

  // Update public link permission
  const handleUpdatePublicPermission = async (perm: 'VIEW' | 'EDIT') => {
    try {
      setSyncStatus('SAVING');
      const res = await api.configurePublicLink(documentId, {
        isEnabled: true,
        permission: perm,
      });
      if (res.success) {
        setSyncStatus('SUCCESS');
        await loadAccessData();
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating link permission');
      setSyncStatus('ERROR');
    }
  };

  // Set password protection on public link
  const handleApplyPublicPassword = async () => {
    try {
      setSyncStatus('SAVING');
      const res = await api.configurePublicLink(documentId, {
        password: publicPassword.trim() || undefined,
      });
      if (res.success) {
        setPublicPassword('');
        setShowPasswordInput(false);
        setSyncStatus('SUCCESS');
        await loadAccessData();
      }
    } catch (err: any) {
      setError(err?.message || 'Error applying password');
      setSyncStatus('ERROR');
    }
  };

  // Copy public link
  const publicShareUrl = typeof window !== 'undefined' && accessData?.publicLink.publicToken
    ? `${window.location.origin}/share/${accessData.publicLink.publicToken}`
    : '';

  const handleCopyLink = () => {
    if (!publicShareUrl) return;
    navigator.clipboard.writeText(publicShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Publishing toggle
  const handleTogglePublish = async () => {
    if (!accessData) return;
    setPublishProcessing(true);
    try {
      setSyncStatus('SAVING');
      if (accessData.publication.isPublished) {
        const res = await api.unpublishDocument(documentId);
        if (res.success) {
          setSyncStatus('SUCCESS');
          await loadAccessData();
        } else {
          setError(res.error?.message || 'Failed to unpublish');
          setSyncStatus('ERROR');
        }
      } else {
        const res = await api.publishDocument(documentId);
        if (res.success) {
          setSyncStatus('SUCCESS');
          await loadAccessData();
        } else {
          setError(res.error?.message || 'Failed to publish');
          setSyncStatus('ERROR');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Publishing operation failed');
      setSyncStatus('ERROR');
    } finally {
      setPublishProcessing(false);
    }
  };

  if (!isOpen) return null;

  const isOwner = accessData?.isOwner ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="w-full max-w-2xl rounded-none bg-[#0D0D0D] border border-[#262626] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sharing-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#202020] bg-[#121212]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#1C1C1C] border border-[#2B2B2B]">
              <Share2 className="h-4 w-4 text-[#F5F5F5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  id="sharing-dialog-title"
                  className="font-mono text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider"
                >
                  SHARING & ACCESS CONTROL
                </h3>
                {accessData?.isOwner && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-[#202020] text-[#A3A3A3] border border-[#333333]">
                    OWNER
                  </span>
                )}
              </div>
              <p className="text-xs text-[#737373] truncate max-w-sm">
                {documentTitle || (accessData as any)?.title || 'Untitled Document'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#737373] hover:text-[#F5F5F5] p-1.5 hover:bg-[#1A1A1A] transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#202020] bg-[#0E0E0E] px-6">
          <button
            type="button"
            onClick={() => setActiveTab('INVITE')}
            className={`font-mono text-xs py-2.5 px-4 border-b-2 font-medium transition-colors ${
              activeTab === 'INVITE'
                ? 'border-[#F5F5F5] text-[#F5F5F5]'
                : 'border-transparent text-[#737373] hover:text-[#A3A3A3]'
            }`}
          >
            COLLABORATORS & INVITES
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PUBLIC')}
            className={`font-mono text-xs py-2.5 px-4 border-b-2 font-medium transition-colors ${
              activeTab === 'PUBLIC'
                ? 'border-[#F5F5F5] text-[#F5F5F5]'
                : 'border-transparent text-[#737373] hover:text-[#A3A3A3]'
            }`}
          >
            PUBLIC LINK SHARING
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PUBLISH')}
            className={`font-mono text-xs py-2.5 px-4 border-b-2 font-medium transition-colors ${
              activeTab === 'PUBLISH'
                ? 'border-[#F5F5F5] text-[#F5F5F5]'
                : 'border-transparent text-[#737373] hover:text-[#A3A3A3]'
            }`}
          >
            PUBLISHING
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-[#1C1111] border border-[#3A1F1F] text-xs text-[#E57373] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSyncStatus('IDLE');
                }}
                className="text-[#E57373] hover:text-white text-xs underline font-mono"
              >
                DISMISS
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="h-5 w-5 text-[#737373] animate-spin" />
              <span className="font-mono text-xs text-[#737373] uppercase tracking-wider">
                LOADING ACCESS RECORDS...
              </span>
            </div>
          ) : (
            <>
              {/* TAB 1: COLLABORATORS & INVITES */}
              {activeTab === 'INVITE' && (
                <div className="space-y-6">
                  {/* Invite People Form (Only owners can invite) */}
                  {isOwner ? (
                    <form onSubmit={handleSendInvitation} className="space-y-3 bg-[#121212] p-4 border border-[#222222]">
                      <div className="flex items-center justify-between">
                        <label className="font-mono text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-wider flex items-center gap-1.5">
                          <UserPlus className="h-3.5 w-3.5 text-[#F5F5F5]" />
                          INVITE PEOPLE
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowInviteMessage(!showInviteMessage)}
                          className="font-mono text-[10px] text-[#737373] hover:text-[#F5F5F5] underline"
                        >
                          {showInviteMessage ? '- HIDE MESSAGE' : '+ ADD INVITATION MESSAGE'}
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#737373]" />
                          <input
                            type="email"
                            required
                            placeholder="operator@organization.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="w-full bg-[#0D0D0D] border border-[#2D2D2D] text-xs text-[#F5F5F5] pl-9 pr-3 py-2 font-mono placeholder:text-[#555555] focus:outline-none focus:border-[#737373]"
                          />
                        </div>

                        <div className="w-full sm:w-36">
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as DocumentRoleType)}
                            className="w-full bg-[#0D0D0D] border border-[#2D2D2D] text-xs text-[#F5F5F5] px-2.5 py-2 font-mono focus:outline-none focus:border-[#737373]"
                          >
                            <option value="VIEWER">VIEWER</option>
                            <option value="COMMENTER">COMMENTER</option>
                            <option value="EDITOR">EDITOR</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          disabled={inviteSending}
                          className="px-4 py-2 bg-[#F5F5F5] text-[#111111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0 transition-colors"
                        >
                          {inviteSending ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              SENDING...
                            </>
                          ) : (
                            'SEND INVITE'
                          )}
                        </button>
                      </div>

                      {showInviteMessage && (
                        <textarea
                          placeholder="Optional personal message to the invitee..."
                          value={inviteMessage}
                          onChange={(e) => setInviteMessage(e.target.value)}
                          rows={2}
                          className="w-full bg-[#0D0D0D] border border-[#2D2D2D] text-xs text-[#F5F5F5] p-2.5 font-sans placeholder:text-[#555555] focus:outline-none focus:border-[#737373]"
                        />
                      )}

                      {inviteFeedback && (
                        <div
                          className={`p-2.5 text-xs font-mono border ${
                            inviteFeedback.type === 'success'
                              ? 'bg-[#112211] border-[#224422] text-[#81C784]'
                              : 'bg-[#221111] border-[#442222] text-[#E57373]'
                          }`}
                        >
                          {inviteFeedback.text}
                        </div>
                      )}
                    </form>
                  ) : (
                    <div className="p-3 bg-[#141414] border border-[#262626] font-mono text-xs text-[#737373]">
                      ONLY DOCUMENT OWNERS CAN ISSUE DIRECT INVITATIONS.
                    </div>
                  )}

                  {/* People with Access */}
                  {(() => {
                    const filteredMembers = (accessData?.members || []).filter(
                      (m) => !accessData?.owner || m.userId !== accessData.owner.id
                    );
                    const totalPeopleCount = (accessData?.owner ? 1 : 0) + filteredMembers.length;

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-wider">
                            PEOPLE WITH ACCESS ({totalPeopleCount})
                          </span>
                        </div>

                        <div className="border border-[#222222] divide-y divide-[#1A1A1A] bg-[#101010]">
                          {/* Document Owner */}
                          {accessData?.owner && (
                            <div className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-[#222222] border border-[#333333] flex items-center justify-center font-mono text-xs text-[#F5F5F5] font-semibold">
                                  {accessData.owner.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-[#F5F5F5]">
                                    {accessData.owner.displayName}
                                  </div>
                                  <div className="font-mono text-[11px] text-[#737373]">
                                    {accessData.owner.email}
                                  </div>
                                </div>
                              </div>
                              <span className="font-mono text-[10px] px-2 py-0.5 bg-[#1B1B1B] text-[#F5F5F5] border border-[#2D2D2D] font-semibold">
                                OWNER
                              </span>
                            </div>
                          )}

                          {/* Authorized Collaborators (excludes owner) */}
                          {filteredMembers.map((member) => (
                            <div key={member.id} className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-[#1A1A1A] border border-[#2D2D2D] flex items-center justify-center font-mono text-xs text-[#A3A3A3]">
                                  {member.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-[#F5F5F5]">
                                    {member.displayName}
                                  </div>
                                  <div className="font-mono text-[11px] text-[#737373]">
                                    {member.email}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {isOwner ? (
                                  <>
                                    <select
                                      value={member.role}
                                      onChange={(e) =>
                                        handleUpdateRole(member.userId, e.target.value as DocumentRoleType)
                                      }
                                      className="bg-[#0D0D0D] border border-[#2B2B2B] text-[11px] text-[#F5F5F5] px-2 py-1 font-mono focus:outline-none"
                                    >
                                      <option value="VIEWER">VIEWER</option>
                                      <option value="COMMENTER">COMMENTER</option>
                                      <option value="EDITOR">EDITOR</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCollaborator(member.userId, member.displayName)}
                                      className="p-1 text-[#737373] hover:text-[#E57373] transition-colors"
                                      title="Revoke access"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="font-mono text-[10px] px-2 py-0.5 bg-[#181818] text-[#A3A3A3] border border-[#2D2D2D]">
                                    {member.role}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}

                          {filteredMembers.length === 0 && (
                            <div className="p-4 text-center text-xs text-[#737373] font-mono">
                              NO ADDITIONAL COLLABORATORS ASSIGNED. INVITE TEAM MEMBERS ABOVE.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pending Invitations */}
                  {accessData?.pendingInvitations && accessData.pendingInvitations.length > 0 && (
                    <div className="space-y-3">
                      <span className="font-mono text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-wider">
                        PENDING INVITATIONS ({accessData.pendingInvitations.length})
                      </span>

                      <div className="border border-[#222222] divide-y divide-[#1A1A1A] bg-[#101010]">
                        {accessData.pendingInvitations.map((inv) => (
                          <div key={inv.id} className="p-3 flex items-center justify-between">
                            <div>
                              <div className="font-mono text-xs text-[#F5F5F5]">
                                {inv.recipientEmail}
                              </div>
                              <div className="font-mono text-[10px] text-[#737373]">
                                Role: {inv.role} • Expires in {Math.max(1, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days
                              </div>
                            </div>

                            {isOwner && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleResendInvitation(inv.id, inv.recipientEmail)}
                                  className="px-2 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#303030] text-[10px] font-mono text-[#F5F5F5]"
                                >
                                  RESEND
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeInvitation(inv.id)}
                                  className="px-2 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#303030] text-[10px] font-mono text-[#E57373]"
                                >
                                  REVOKE
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PUBLIC LINK SHARING */}
              {activeTab === 'PUBLIC' && (
                <div className="space-y-5">
                  <div className="p-4 bg-[#121212] border border-[#222222] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#1A1A1A] border border-[#2A2A2A]">
                          {accessData?.publicLink.isEnabled ? (
                            <Globe className="h-4 w-4 text-[#F5F5F5]" />
                          ) : (
                            <Lock className="h-4 w-4 text-[#737373]" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#F5F5F5]">
                            Public Link Sharing
                          </div>
                          <p className="text-[11px] text-[#737373]">
                            {accessData?.publicLink.isEnabled
                              ? 'Anyone with this unique URL can access the document'
                              : 'Link access is disabled. Only authorized collaborators have access'}
                          </p>
                        </div>
                      </div>

                      {isOwner ? (
                        <button
                          type="button"
                          onClick={handleTogglePublicLink}
                          className={`px-3 py-1.5 font-mono text-xs font-semibold border transition-colors ${
                            accessData?.publicLink.isEnabled
                              ? 'bg-[#F5F5F5] text-[#111111] border-transparent'
                              : 'bg-[#181818] text-[#737373] border-[#2D2D2D] hover:text-[#F5F5F5]'
                          }`}
                        >
                          {accessData?.publicLink.isEnabled ? 'ENABLED' : 'DISABLED'}
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-[#737373]">
                          {accessData?.publicLink.isEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      )}
                    </div>

                    {accessData?.publicLink.isEnabled && (
                      <div className="pt-3 border-t border-[#1E1E1E] space-y-4">
                        {/* Access Permission selector */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-[#737373] uppercase tracking-wider">
                            PUBLIC PERMISSION
                          </span>
                          {isOwner ? (
                            <div className="flex gap-1 font-mono text-xs">
                              <button
                                type="button"
                                onClick={() => handleUpdatePublicPermission('VIEW')}
                                className={`px-2.5 py-1 border transition-colors ${
                                  accessData.publicLink.permission === 'VIEW'
                                    ? 'bg-[#222222] border-[#555555] text-[#F5F5F5]'
                                    : 'border-transparent text-[#737373] hover:text-[#F5F5F5]'
                                }`}
                              >
                                VIEW ONLY
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdatePublicPermission('EDIT')}
                                className={`px-2.5 py-1 border transition-colors ${
                                  accessData.publicLink.permission === 'EDIT'
                                    ? 'bg-[#222222] border-[#555555] text-[#F5F5F5]'
                                    : 'border-transparent text-[#737373] hover:text-[#F5F5F5]'
                                }`}
                              >
                                EDIT
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-[#A3A3A3]">
                              {accessData.publicLink.permission}
                            </span>
                          )}
                        </div>

                        {/* URL copy block */}
                        <div className="flex items-center gap-2 bg-[#0B0B0B] border border-[#222222] p-2">
                          <input
                            type="text"
                            readOnly
                            value={publicShareUrl}
                            className="flex-1 bg-transparent text-xs text-[#F5F5F5] font-mono px-2 focus:outline-none select-all"
                          />
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="px-3 py-1.5 bg-[#F5F5F5] text-[#111111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedLink ? 'COPIED' : 'COPY LINK'}</span>
                          </button>
                        </div>

                        {/* Password protection */}
                        {isOwner && (
                          <div className="pt-2 border-t border-[#1C1C1C] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Key className="h-3.5 w-3.5 text-[#737373]" />
                              <span className="font-mono text-[11px] text-[#A3A3A3]">
                                PASSWORD PROTECTION:{' '}
                                {accessData.publicLink.hasPassword ? 'ACTIVE (ARGON2)' : 'NONE'}
                              </span>
                            </div>

                            {showPasswordInput ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="password"
                                  placeholder="New access password"
                                  value={publicPassword}
                                  onChange={(e) => setPublicPassword(e.target.value)}
                                  className="bg-[#0B0B0B] border border-[#2D2D2D] text-xs text-[#F5F5F5] px-2 py-1 font-mono focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={handleApplyPublicPassword}
                                  className="px-2 py-1 bg-[#F5F5F5] text-[#111] font-mono text-xs font-semibold"
                                >
                                  SAVE
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowPasswordInput(false)}
                                  className="text-[#737373] text-xs font-mono"
                                >
                                  CANCEL
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowPasswordInput(true)}
                                className="font-mono text-[11px] text-[#A3A3A3] hover:text-[#F5F5F5] underline"
                              >
                                {accessData.publicLink.hasPassword ? 'CHANGE PASSWORD' : '+ SET PASSWORD'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: PUBLISHING */}
              {activeTab === 'PUBLISH' && (
                <div className="space-y-5">
                  <div className="p-4 bg-[#121212] border border-[#222222] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#1A1A1A] border border-[#2A2A2A]">
                          <FileCheck className="h-4 w-4 text-[#F5F5F5]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#F5F5F5]">
                              Publish Document Release
                            </span>
                            <span
                              className={`font-mono text-[10px] px-2 py-0.2 border ${
                                accessData?.publication.isPublished
                                  ? 'bg-[#112211] border-[#224422] text-[#81C784]'
                                  : 'bg-[#1E1E1E] border-[#2E2E2E] text-[#A3A3A3]'
                              }`}
                            >
                              {accessData?.publication.status || 'DRAFT'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#737373]">
                            Publishing creates an official frozen release version of this document.
                          </p>
                        </div>
                      </div>

                      {isOwner && (
                        <button
                          type="button"
                          disabled={publishProcessing}
                          onClick={handleTogglePublish}
                          className={`px-3 py-1.5 font-mono text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                            accessData?.publication.isPublished
                              ? 'bg-[#181818] text-[#E57373] border-[#3E2222] hover:bg-[#201515]'
                              : 'bg-[#F5F5F5] text-[#111111] border-transparent hover:bg-[#E5E5E5]'
                          }`}
                        >
                          {publishProcessing && <RefreshCw className="h-3 w-3 animate-spin" />}
                          {accessData?.publication.isPublished ? 'UNPUBLISH TO DRAFT' : 'PUBLISH RELEASE'}
                        </button>
                      )}
                    </div>

                    {accessData?.publication.isPublished && (
                      <div className="pt-3 border-t border-[#1E1E1E] space-y-2 font-mono text-[11px] text-[#737373]">
                        <div>
                          RELEASE STATUS: <span className="text-[#81C784]">OFFICIALLY PUBLISHED</span>
                        </div>
                        {accessData.publication.publishedAt && (
                          <div>
                            PUBLISHED ON:{' '}
                            <span className="text-[#F5F5F5]">
                              {new Date(accessData.publication.publishedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div>
                          SNAPSHOT REVISION: <span className="text-[#F5F5F5]">v{accessData.publication.version}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#202020] bg-[#121212] flex items-center justify-between font-mono text-[10px] text-[#555555]">
          <div className="flex items-center gap-2">
            <Shield className="h-3 w-3 text-[#737373]" />
            <span>CRYPTOGRAPHIC TOKEN HASH: SHA-256 (256-BIT)</span>
          </div>
          <div>
            {syncStatus === 'SAVING' && <span className="text-[#F5F5F5]">SYNCHRONIZING...</span>}
            {syncStatus === 'SUCCESS' && <span className="text-[#81C784]">SYNCHRONIZED</span>}
            {syncStatus === 'ERROR' && <span className="text-[#E57373]">SYNC ERROR</span>}
            {syncStatus === 'IDLE' && <span>READY</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
