'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/auth-layout';
import { Button, Input, Card, Alert } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api';
import { Compass, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [workspaceName, setWorkspaceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError('Please provide your operator or legal name');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.completeOnboarding({
        displayName: displayName.trim(),
        workspaceName: workspaceName.trim() || undefined,
      });

      if (result.success) {
        await refreshUser();
        router.push('/dashboard');
      } else {
        setError(result.error?.message || 'Failed to complete workspace onboarding.');
      }
    } catch {
      setError('An unexpected communication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#737373]">
            <Compass className="h-3 w-3 text-[#FAFAFA]" />
            <span>OPERATOR INITIALIZATION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
            Configure Workspace
          </h1>
          <p className="text-sm text-[#737373]">
            Complete your sovereign operator setup and initialize your primary workspace cluster.
          </p>
        </div>

        <Card className="p-6 sm:p-7 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <Alert
                type="error"
                title="SETUP ERROR"
                message={error}
                onDismiss={() => setError('')}
              />
            )}

            <Input
              id="onboarding-name"
              label="Operator Name"
              sublabel="PUBLIC IDENTIFIER"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Cheran A."
              autoFocus
              disabled={isLoading}
            />

            <Input
              id="onboarding-workspace"
              label="Primary Workspace Domain"
              sublabel="INITIAL REPOSITORY"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Core Architecture or Personal Notes"
              hint="You can create additional workspaces anytime in settings."
              disabled={isLoading}
            />

            <div className="pt-2">
              <Button type="submit" fullWidth size="lg" isLoading={isLoading} className="group">
                <span>Complete Initialization</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AuthLayout>
  );
}
