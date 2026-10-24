'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandWordmark } from '@/components/ui';
import {
  ShieldCheck,
  Lock,
  Mail,
  UserCheck,
  Users,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { api, InvitationDetails } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { areEmailsMatching } from '@/lib/email-identity';

function InvitationAcceptancePageContent() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const { user, isLoading: authLoading, logout } = useAuth();

  const handleSwitchAccount = async (targetPath: string) => {
    try {
      await logout(targetPath);
    } catch {
      router.push(targetPath);
    }
  };

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    api.getInvitationDetails(token).then((res) => {
      if (res.success && res.data) {
        setInvitation(res.data);
      } else {
        setError(res.error?.message || 'Invalid or expired invitation token.');
        setErrorCode(res.error?.code || 'INVALID_TOKEN');
      }
      setLoading(false);
    });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await api.acceptInvitation(token);
      if (res.success && res.data) {
        setAcceptedSuccess(true);
        if (res.data.workspaceId) {
          api.setActiveWorkspaceId(res.data.workspaceId);
        }
        const isWorkspaceInvite = String(invitation?.type || '').toUpperCase() === 'WORKSPACE';
        const redirect = res.data.redirectUrl || (isWorkspaceInvite ? '/collaboration' : `/documents/${res.data.documentId}`);
        setTimeout(() => {
          router.push(redirect);
        }, 1200);
      } else {
        setError(res.error?.message || 'Failed to accept invitation');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error accepting invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="h-screen w-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] animate-pulse">
        VALIDATING CRYPTOGRAPHIC INVITATION TOKEN...
      </div>
    );
  }

  if (error && !invitation) {
    const isAlreadyAccepted = errorCode === 'ALREADY_ACCEPTED';
    const isRevoked = errorCode === 'INVITATION_REVOKED';
    const isExpired = errorCode === 'INVITATION_EXPIRED';

    const titleText = isAlreadyAccepted
      ? 'INVITATION ALREADY ACCEPTED'
      : isRevoked
      ? 'INVITATION REVOKED'
      : isExpired
      ? 'INVITATION EXPIRED'
      : 'INVITATION UNREACHABLE';

    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-[#101010] border border-[#2B2B2B] text-center space-y-5">
          <div className="w-12 h-12 mx-auto bg-[#1C1111] border border-[#3A1F1F] flex items-center justify-center">
            {isAlreadyAccepted ? (
              <CheckCircle className="h-6 w-6 text-[#81C784]" />
            ) : (
              <Lock className="h-6 w-6 text-[#E57373]" />
            )}
          </div>
          <h2 className="text-base font-semibold text-[#F5F5F5] font-mono uppercase tracking-wider">
            {titleText}
          </h2>
          <p className="text-xs text-[#A3A3A3] leading-relaxed">
            {error || 'This invitation link is invalid, expired, or has been revoked by the workspace administrator.'}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href="/documents"
              className="inline-block px-4 py-2 bg-[#F5F5F5] text-[#111] font-mono text-xs font-semibold uppercase tracking-wider hover:bg-[#E5E5E5] transition-colors"
            >
              GO TO DOCUMENTS
            </Link>
            <Link
              href="/collaboration"
              className="inline-block px-4 py-2 bg-[#1C1C1C] text-[#A3A3A3] border border-[#333] font-mono text-xs font-semibold uppercase tracking-wider hover:text-[#FAFAFA] transition-colors"
            >
              WORKSPACE HUB
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isEmailMatching = Boolean(
    user && invitation && (
      areEmailsMatching(user.email, invitation.recipientEmail) ||
      ((user as any).emailNormalized && areEmailsMatching((user as any).emailNormalized, invitation.recipientEmail))
    )
  );

  const isWorkspace = String(invitation?.type || '').toUpperCase() === 'WORKSPACE';

  return (
    <div className="min-h-screen bg-[#080808] text-[#F5F5F5] flex flex-col justify-between selection:bg-[#FAFAFA] selection:text-[#111111]">
      {/* Top Header */}
      <header className="border-b border-[#1F1F1F] px-6 py-4 bg-[#0A0A0A]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <BrandWordmark size="sm" subtitle={isWorkspace ? 'WORKSPACE COLLABORATION' : 'DOCUMENT ACCESS'} />
          <div className="font-mono text-[11px] text-[#737373]">
            SECURE TOKEN VERIFICATION
          </div>
        </div>
      </header>

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center p-4 my-8">
        <div className="max-w-lg w-full bg-[#101010] border border-[#262626] p-8 space-y-6 shadow-2xl">
          {acceptedSuccess ? (
            <div className="text-center space-y-4 py-4 animate-fade-in">
              <div className="w-12 h-12 mx-auto bg-[#112211] border border-[#224422] flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-[#81C784]" />
              </div>
              <h2 className="font-mono text-sm font-semibold text-[#F5F5F5] uppercase tracking-wider">
                ACCESS GRANTED
              </h2>
              <p className="text-xs text-[#A3A3A3]">
                Your membership has been registered. Redirecting to {isWorkspace ? 'workspace collaboration hub' : 'document'}...
              </p>
              <div className="font-mono text-xs text-[#737373] animate-pulse">
                INITIALIZING WORKSPACE CONTEXT...
              </div>
            </div>
          ) : (
            <>
              {/* Workspace or Document Identity */}
              <div className="space-y-2 border-b border-[#1E1E1E] pb-5">
                <span className="font-mono text-[10px] text-[#737373] uppercase tracking-wider">
                  {isWorkspace ? 'WORKSPACE INVITATION' : 'COLLABORATION INVITATION'}
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#181920] border border-zinc-700/80 flex items-center justify-center shrink-0">
                    {isWorkspace ? (
                      <Users className="w-6 h-6 text-zinc-100" />
                    ) : (
                      <span className="text-2xl">{invitation?.document?.icon || '📄'}</span>
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl font-medium text-[#F5F5F5]">
                      {isWorkspace
                        ? invitation?.workspace?.name || 'Authorized Workspace'
                        : invitation?.document?.title || 'Shared Document'}
                    </h1>
                    <p className="font-mono text-xs text-[#737373]">
                      Invited by {invitation?.inviter?.displayName || 'Teammate'} ({invitation?.inviter?.email})
                    </p>
                  </div>
                </div>
              </div>

              {/* Invitation Metadata Details */}
              <div className="p-4 bg-[#0D0D0D] border border-[#1F1F1F] space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#737373]">ASSIGNED PERMISSION</span>
                  <span className="px-2 py-0.5 bg-[#1C1C1C] text-[#F5F5F5] border border-[#333] font-semibold">
                    {invitation?.role}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#737373]">INTENDED RECIPIENT</span>
                  <span className="text-[#F5F5F5]">{invitation?.recipientEmail}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#737373]">SECURITY HASH</span>
                  <span className="text-[#A3A3A3]">SHA-256 (VERIFIED)</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-[#1C1111] border border-[#3A1F1F] text-xs text-[#E57373] flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action based on Auth state */}
              {!user ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-[#A3A3A3] text-center">
                    You must sign in with <span className="text-[#F5F5F5] font-mono">{invitation?.recipientEmail}</span> to accept this invitation.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/login?redirect=/invite/${token}`}
                      className="flex-1 py-2.5 bg-[#F5F5F5] text-[#111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold text-center uppercase tracking-wider transition-colors"
                    >
                      SIGN IN
                    </Link>
                    <Link
                      href={`/register?email=${encodeURIComponent(invitation?.recipientEmail || '')}&redirect=/invite/${token}`}
                      className="flex-1 py-2.5 bg-[#151515] text-[#F5F5F5] hover:bg-[#202020] border border-[#2D2D2D] font-mono text-xs font-semibold text-center uppercase tracking-wider transition-colors"
                    >
                      CREATE ACCOUNT
                    </Link>
                  </div>
                </div>
              ) : !isEmailMatching ? (
                <div className="p-4 bg-[#1C1111] border border-[#3A1F1F] space-y-4">
                  <div className="flex items-center gap-2 text-xs text-[#E57373]">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-semibold uppercase tracking-wider">AUTHENTICATION MISMATCH</span>
                  </div>
                  <p className="text-xs text-[#A3A3A3] leading-relaxed">
                    This invitation was sent specifically to <span className="text-[#F5F5F5] font-mono font-semibold">{invitation?.recipientEmail}</span>, but you are currently signed in as <span className="text-[#F5F5F5] font-mono font-semibold">{user.email}</span>.
                  </p>
                  <p className="text-[11px] text-[#888888] leading-relaxed">
                    For enterprise security and access audit integrity, an invitation must be accepted by the intended account. Sign out to switch accounts, or open this URL in an Incognito / Private window.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSwitchAccount(`/login?email=${encodeURIComponent(invitation?.recipientEmail || '')}&redirect=/invite/${token}`)}
                      className="flex-1 py-2.5 px-3 bg-[#F5F5F5] text-[#111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold text-center uppercase tracking-wider transition-colors"
                    >
                      SWITCH ACCOUNT
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchAccount(`/register?email=${encodeURIComponent(invitation?.recipientEmail || '')}&redirect=/invite/${token}`)}
                      className="flex-1 py-2.5 px-3 bg-[#181920] text-[#F5F5F5] hover:bg-[#252630] border border-zinc-700 font-mono text-xs font-semibold text-center uppercase tracking-wider transition-colors"
                    >
                      REGISTER RECIPIENT
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full py-3 bg-[#F5F5F5] text-[#111111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {accepting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        PROCESSING ACCEPTANCE...
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        {isWorkspace
                          ? 'ACCEPT INVITATION & JOIN WORKSPACE'
                          : 'ACCEPT INVITATION & OPEN DOCUMENT'}
                      </>
                    )}
                  </button>
                  <p className="font-mono text-[10px] text-center text-[#737373]">
                    By accepting, you will join as a verified collaborator with {invitation?.role} permissions.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1C1C1C] py-4 text-center font-mono text-xs text-[#505050]">
        POWERED BY KRONOS SOVEREIGN PRODUCTIVITY & AI WORKSPACE
      </footer>
    </div>
  );
}

export default function InvitationAcceptancePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] animate-pulse">
          INITIALIZING...
        </div>
      }
    >
      <InvitationAcceptancePageContent />
    </Suspense>
  );
}
