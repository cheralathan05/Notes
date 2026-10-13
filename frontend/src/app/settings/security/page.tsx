'use client';

import React, { useState } from 'react';
import AppShell from '@/components/app-shell';
import { Card, PasswordInput, PasswordStrengthMeter, Button, Alert } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api';
import { Shield, KeyRound, Lock, CheckCircle2, RefreshCw } from 'lucide-react';

export default function SecuritySettingsPage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [resendingVerification, setResendingVerification] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!currentPassword) {
      setErrorMessage('Current password is required');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage('New password must be different from current password');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });

      if (result.success) {
        setSuccessMessage('Password changed successfully. All other active sessions have been revoked.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setErrorMessage(result.error?.message || 'Failed to change password');
      }
    } catch {
      setErrorMessage('Communication error while changing password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyMessage('');
    setResendingVerification(true);
    try {
      const result = await api.resendVerification();
      if (result.success) {
        setVerifyMessage('A fresh verification link was dispatched to your inbox.');
      } else {
        setVerifyMessage(result.error?.message || 'Failed to dispatch verification.');
      }
    } catch {
      setVerifyMessage('Network error dispatching verification.');
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <AppShell
      headerTitle="Security & Authentication"
      headerSubtitle="Configure master credentials, session revocation, and cryptographic parameters"
    >
      <div className="max-w-3xl space-y-8">
        {successMessage && (
          <Alert
            type="success"
            title="SECURITY UPDATED"
            message={successMessage}
            onDismiss={() => setSuccessMessage('')}
          />
        )}

        {errorMessage && (
          <Alert
            type="error"
            title="OPERATION REJECTED"
            message={errorMessage}
            onDismiss={() => setErrorMessage('')}
          />
        )}

        {/* Change Password Form */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-6 border-b border-[#222222]">
            <div className="p-2.5 rounded-[var(--radius-xs)] bg-[#101010] border border-[#2D2D2D] text-[#FAFAFA]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#FAFAFA] tracking-tight">
                Update Master Passphrase
              </h2>
              <p className="text-xs text-[#737373]">
                Updating your master password invalidates all other active device tokens automatically.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-5">
            <PasswordInput
              id="current-password"
              label="Current Password"
              sublabel="VERIFICATION REQUIRED"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={isLoading}
            />

            <div className="space-y-2">
              <PasswordInput
                id="new-password"
                label="New Master Password"
                sublabel="MINIMUM 8 CHARACTERS"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter hardened new passphrase"
                disabled={isLoading}
              />
              {newPassword && <PasswordStrengthMeter password={newPassword} />}
            </div>

            <PasswordInput
              id="confirm-new-password"
              label="Confirm New Password"
              sublabel="MATCH VERIFICATION"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Repeat new passphrase"
              disabled={isLoading}
            />

            <div className="flex justify-end pt-4 border-t border-[#222222]">
              <Button type="submit" size="md" isLoading={isLoading}>
                Update Master Password
              </Button>
            </div>
          </form>
        </Card>

        {/* Email Verification Status Card */}
        <Card variant="subtle" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[var(--radius-xs)] bg-[#151515] border border-[#2D2D2D] text-[#FAFAFA]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#FAFAFA]">
                  Email Security Verification
                </p>
                <p className="text-xs text-[#737373] font-mono">
                  {user?.emailVerified ? 'Cryptographically confirmed' : 'Pending inbox confirmation'}
                </p>
              </div>
            </div>

            {!user?.emailVerified && (
              <Button
                variant="outline"
                size="sm"
                isLoading={resendingVerification}
                onClick={handleResendVerification}
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Resend Verification
              </Button>
            )}
          </div>

          {verifyMessage && (
            <p className="text-xs font-mono text-[#FAFAFA] pt-2">{verifyMessage}</p>
          )}
        </Card>

        {/* Cryptographic Standards */}
        <Card variant="subtle" className="p-6 font-mono text-xs text-[#737373] space-y-2.5">
          <div className="text-[#FAFAFA] font-semibold text-xs pb-1 border-b border-[#222222]">
            SECURITY POLICIES & STANDARDS
          </div>
          <div className="flex justify-between">
            <span>PASSWORD STORAGE:</span>
            <span className="text-[#FAFAFA]">Argon2id (Salted & Peppered)</span>
          </div>
          <div className="flex justify-between">
            <span>SESSION LIFETIME:</span>
            <span className="text-[#FAFAFA]">7 Days (HttpOnly + Secure)</span>
          </div>
          <div className="flex justify-between">
            <span>MULTI-SESSION POLICY:</span>
            <span className="text-[#FAFAFA]">Independent Device Tokens</span>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
