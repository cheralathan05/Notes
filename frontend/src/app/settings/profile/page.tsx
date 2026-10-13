'use client';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/app-shell';
import { Card, Input, Button, Alert, Badge } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api';
import { UserCheck, ShieldCheck, Save, Calendar, Hash } from 'lucide-react';

export default function ProfileSettingsPage() {
  const { user, updateUser, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!displayName.trim()) {
      setErrorMessage('Display name cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.updateProfile({ displayName: displayName.trim() });
      if (result.success && result.data?.user) {
        updateUser(result.data.user);
        setSuccessMessage('Operator profile successfully synchronized.');
      } else {
        setErrorMessage(result.error?.message || 'Failed to update profile.');
      }
    } catch {
      setErrorMessage('Communication error with profile service.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell
      headerTitle="Operator Profile"
      headerSubtitle="Manage your identity credentials and public operator metadata"
    >
      <div className="max-w-3xl space-y-8">
        {successMessage && (
          <Alert
            type="success"
            title="PROFILE SYNCHRONIZED"
            message={successMessage}
            onDismiss={() => setSuccessMessage('')}
          />
        )}

        {errorMessage && (
          <Alert
            type="error"
            title="UPDATE REJECTED"
            message={errorMessage}
            onDismiss={() => setErrorMessage('')}
          />
        )}

        {/* Identity Overview Panel */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#222222]">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] flex items-center justify-center font-mono text-2xl font-bold text-[#FAFAFA] shadow-inner">
                {displayName ? displayName.slice(0, 1).toUpperCase() : 'U'}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#FAFAFA] tracking-tight">
                  {displayName || 'Operator'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs text-[#737373]">{user?.email}</span>
                  <Badge variant={user?.emailVerified ? 'active' : 'default'}>
                    {user?.emailVerified ? 'VERIFIED' : 'ACTIVE'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="font-mono text-xs text-[#737373] space-y-1">
              <div className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                <span>UID: {user?.id?.slice(0, 10)}...</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>SINCE: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '2026'}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input
                id="display-name"
                label="Display Name / Alias"
                sublabel="PUBLIC IDENTIFIER"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Cheran A."
                disabled={isLoading}
              />

              <Input
                id="email-readonly"
                label="Email Identity"
                sublabel="PRIMARY (LOCKED)"
                value={user?.email || ''}
                readOnly
                disabled
                hint="Contact security team to change primary authorization address."
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-[#222222]">
              <Button type="submit" size="md" isLoading={isLoading}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Profile
              </Button>
            </div>
          </form>
        </Card>

        {/* Security Posture Sub-Panel */}
        <Card variant="subtle" className="p-6 space-y-3">
          <div className="flex items-center gap-2 font-mono text-xs text-[#FAFAFA]">
            <ShieldCheck className="h-4 w-4" />
            <span>CRYPTOGRAPHIC JURISDICTION</span>
          </div>
          <p className="text-xs text-[#737373] leading-relaxed">
            Your identity is stored in isolated PostgreSQL tables with normalized email hashing, preventing enumeration attacks and cross-tenant leakage.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
