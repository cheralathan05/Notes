'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthLayout from '@/components/auth-layout';
import { Button, PasswordInput, PasswordStrengthMeter, Card, Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Authorization token missing or invalid. Please request a new recovery link.');
      return;
    }

    if (password.length < 8) {
      setError('New passphrase must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passphrases do not match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.resetPassword({
        token,
        password,
        confirmPassword,
      });

      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => router.push('/login'), 2500);
      } else {
        setError(result.error?.message || 'Failed to update credentials.');
      }
    } catch {
      setError('Communication error with authentication cluster.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center animate-fade-in">
        <div className="inline-flex p-3 rounded-full bg-[#151515] border border-[#2D2D2D] text-[#FAFAFA]">
          <CheckCircle2 className="h-8 w-8 stroke-[1.5]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
            Credentials Updated
          </h1>
          <p className="text-sm text-[#737373]">
            Your new passphrase is now active. All other sessions have been revoked.
          </p>
        </div>
        <Card className="p-6 space-y-4">
          <p className="text-xs font-mono text-[#A3A3A3]">
            REDIRECTING TO SIGN IN IN 2 SECONDS...
          </p>
          <Button fullWidth size="lg" onClick={() => router.push('/login')}>
            Sign In Now
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#737373]">
          <KeyRound className="h-3 w-3 text-[#FAFAFA]" />
          <span>AUTHORIZATION VERIFIED</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
          Set New Passphrase
        </h1>
        <p className="text-sm text-[#737373]">
          Configure your new master key credentials.
        </p>
      </div>

      <Card className="p-6 sm:p-7 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert
              type="error"
              title="AUTHORIZATION FAILED"
              message={error}
              onDismiss={() => setError('')}
            />
          )}

          <div className="space-y-2">
            <PasswordInput
              id="token-new-password"
              label="New Master Key"
              sublabel="MINIMUM 8 CHARACTERS"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new passphrase"
              autoFocus
              disabled={isLoading}
            />
            {password && <PasswordStrengthMeter password={password} />}
          </div>

          <PasswordInput
            id="token-confirm-password"
            label="Confirm Key"
            sublabel="MATCH VERIFICATION"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new passphrase"
            disabled={isLoading}
          />

          <div className="pt-2">
            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
            >
              Confirm New Passphrase
            </Button>
          </div>
        </form>
      </Card>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-mono text-[#737373] hover:text-[#FAFAFA] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>RETURN TO SIGN IN</span>
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <React.Suspense
        fallback={
          <div className="h-64 flex items-center justify-center font-mono text-xs text-[#737373]">
            VERIFYING RECOVERY TOKEN...
          </div>
        }
      >
        <ResetPasswordForm />
      </React.Suspense>
    </AuthLayout>
  );
}
