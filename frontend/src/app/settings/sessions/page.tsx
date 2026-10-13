'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/app-shell';
import { Card, Button, Badge, Alert, Modal } from '@/components/ui';
import { api, SessionInfo } from '@/lib/api';
import { Laptop, Smartphone, Globe, ShieldAlert, Trash2, RefreshCw } from 'lucide-react';

export default function SessionsSettingsPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Confirmation dialogs
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.getSessions();
      if (result.success && result.data?.sessions) {
        setSessions(result.data.sessions);
      } else {
        setError(result.error?.message || 'Failed to retrieve active sessions.');
      }
    } catch {
      setError('Communication error fetching sessions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSingle = async () => {
    if (!confirmRevokeId) return;
    setActionLoading(true);
    setMessage('');
    setError('');

    try {
      const result = await api.revokeSession(confirmRevokeId);
      if (result.success) {
        setMessage('Session successfully terminated.');
        setConfirmRevokeId(null);
        await fetchSessions();
      } else {
        setError(result.error?.message || 'Failed to revoke session.');
      }
    } catch {
      setError('Communication error revoking session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeOthers = async () => {
    setActionLoading(true);
    setMessage('');
    setError('');

    try {
      const result = await api.revokeOtherSessions();
      if (result.success) {
        setMessage(`Revoked ${result.data?.count ?? 'all other'} active session(s).`);
        setConfirmRevokeAll(false);
        await fetchSessions();
      } else {
        setError(result.error?.message || 'Failed to revoke other sessions.');
      }
    } catch {
      setError('Communication error revoking other sessions.');
    } finally {
      setActionLoading(false);
    }
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return { device: 'Unknown Client', icon: Globe };
    if (/iphone|android|mobile/i.test(ua)) {
      return { device: 'Mobile Device', icon: Smartphone };
    }
    return { device: 'Desktop Workstation', icon: Laptop };
  };

  return (
    <AppShell
      headerTitle="Active Sessions"
      headerSubtitle="Manage authorization tokens across devices and inspect active connections"
    >
      <div className="max-w-4xl space-y-8">
        {message && (
          <Alert
            type="success"
            title="SESSION PROTOCOL"
            message={message}
            onDismiss={() => setMessage('')}
          />
        )}

        {error && (
          <Alert
            type="error"
            title="OPERATION FAILED"
            message={error}
            onDismiss={() => setError('')}
          />
        )}

        {/* Action Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D]">
          <div>
            <h2 className="text-sm font-semibold text-[#FAFAFA] uppercase tracking-wider font-mono">
              SESSION MANAGEMENT CLUSTER
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Revoking terminates cryptographic tokens immediately.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSessions}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3 w-3 mr-1.5 ${isLoading ? 'animate-spin-slow' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmRevokeAll(true)}
              disabled={sessions.length <= 1 || actionLoading}
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              Revoke All Others
            </Button>
          </div>
        </div>

        {/* Session List */}
        <div className="space-y-3">
          {isLoading && sessions.length === 0 ? (
            <div className="p-12 text-center font-mono text-xs text-[#737373]">
              QUERYING ACTIVE SESSION REGISTRY...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center font-mono text-xs text-[#737373]">
              NO ACTIVE SESSIONS FOUND.
            </div>
          ) : (
            sessions.map((sess) => {
              const { device, icon: DeviceIcon } = parseUserAgent(sess.userAgent);
              return (
                <Card
                  key={sess.id}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    sess.isCurrent ? 'bg-[#151515] border-[#505050]' : 'bg-[#101010] hover:bg-[#151515]'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-[var(--radius-xs)] bg-[#1D1D1D] border border-[#2D2D2D] text-[#FAFAFA]">
                      <DeviceIcon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#FAFAFA]">{device}</span>
                        {sess.isCurrent && <Badge variant="active">CURRENT SESSION</Badge>}
                      </div>
                      <p className="text-xs font-mono text-[#A3A3A3] truncate max-w-md">
                        {sess.userAgent || 'Standard HTTP Client'}
                      </p>
                      <div className="flex items-center gap-4 text-[11px] font-mono text-[#737373] pt-0.5">
                        <span>IP: {sess.ipAddress || '127.0.0.1'}</span>
                        <span>•</span>
                        <span>
                          LAST ACTIVE: {new Date(sess.lastActivityAt).toLocaleTimeString()} (
                          {new Date(sess.lastActivityAt).toLocaleDateString()})
                        </span>
                      </div>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmRevokeId(sess.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        {/* Modal: Confirm Revoke Single */}
        <Modal
          isOpen={!!confirmRevokeId}
          onClose={() => setConfirmRevokeId(null)}
          title="Revoke Session Token"
          description="This action terminates authorization for this specific client immediately."
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              The target device will be signed out immediately and required to re-authenticate with their master password.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRevokeId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={actionLoading}
                onClick={handleRevokeSingle}
              >
                Confirm Revocation
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Confirm Revoke All Others */}
        <Modal
          isOpen={confirmRevokeAll}
          onClose={() => setConfirmRevokeAll(false)}
          title="Revoke All Other Sessions"
          description="Terminate all active devices and client instances except this current browser."
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              All other computers, mobile browsers, and API tokens tied to this account will be invalidated immediately.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRevokeAll(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={actionLoading}
                onClick={handleRevokeOthers}
              >
                Revoke All Others
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
