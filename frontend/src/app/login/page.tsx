'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthLayout from '@/components/auth-layout';
import { Button, Input, PasswordInput, Card, Alert, Checkbox } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { LockKeyhole, ArrowRight } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { login, demoLogin } = useAuth();

  React.useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!email.trim()) {
      errors.email = 'Identifier or email required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please provide a valid email format';
    }

    if (!password) {
      errors.password = 'Credential key required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  
  const handleDemoLogin = async (role: 'owner' | 'collaborator') => {
    setError('');
    setIsDemoLoading(true);
    try {
      const res = await demoLogin(role);
      if (res.success) {
        const redirect = searchParams.get('redirect');
        const safePath = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard';
        router.push(safePath);
      } else {
        setError(res.error || 'Demo authentication failed');
      }
    } catch {
      setError('Communication error with authentication cluster. Please retry.');
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        const redirect = searchParams.get('redirect');
        const safePath = redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard';
        router.push(safePath);
      } else {
        setError(result.error || 'Authentication rejected. Check your credentials.');
      }
    } catch {
      setError('Communication error with authentication cluster. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Editorial Form Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#737373]">
          <LockKeyhole className="h-3 w-3 text-[#FAFAFA]" />
          <span>AUTHENTICATION GATEWAY</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
          Sign in to Kronos
        </h1>
        <p className="text-sm text-[#737373]">
          Enter your authorized email and credentials to resume your session.
        </p>
      </div>

      {/* Main Form Card */}
      <Card variant="default" className="p-6 sm:p-7 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert
              type="error"
              title="ACCESS DENIED"
              message={error}
              onDismiss={() => setError('')}
            />
          )}

          <Input
            id="login-email"
            label="Email Identity"
            sublabel="USER IDENTIFIER"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((prev) => ({ ...prev, email: '' }));
            }}
            placeholder="operator@kronos.io"
            error={fieldErrors.email}
            autoComplete="email"
            autoFocus
            disabled={isLoading}
          />

          <div className="space-y-1">
            <PasswordInput
              id="login-password"
              label="Secret Key"
              sublabel="ARGON2ID VERIFIED"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: '' }));
              }}
              placeholder="••••••••••••"
              error={fieldErrors.password}
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <Checkbox
              id="remember-me"
              label="Maintain active session"
              checked={rememberMe}
              onChange={setRememberMe}
              disabled={isLoading}
            />
            <Link
              href="/forgot-password"
              className="text-xs font-mono text-[#737373] hover:text-[#FAFAFA] transition-colors"
            >
              Recover access?
            </Link>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              className="group"
            >
              <span>Authenticate Session</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>

        </form>

        {/* 1-Click Demo Personas */}
        <div className="pt-4 border-t border-[#1F1F1F] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#A3A3A3] tracking-widest uppercase flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              1-CLICK DEMO ACCESS
            </span>
            <Link
              href="/checklist"
              className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
            >
              System Checklist →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLoading || isDemoLoading}
              onClick={() => handleDemoLogin('owner')}
              className="p-2.5 rounded-[4px] bg-[#121212] border border-[#2D2D2D] hover:border-cyan-500 hover:bg-[#181818] text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between text-xs text-[#FAFAFA] font-medium group-hover:text-cyan-400">
                <span>Principal Architect</span>
                <span className="text-[9px] px-1 rounded bg-[#222222] text-[#888888] font-mono">OWNER</span>
              </div>
              <div className="text-[11px] text-[#737373] truncate font-mono mt-0.5">
                architect.demo@kronos.io
              </div>
            </button>

            <button
              type="button"
              disabled={isLoading || isDemoLoading}
              onClick={() => handleDemoLogin('collaborator')}
              className="p-2.5 rounded-[4px] bg-[#121212] border border-[#2D2D2D] hover:border-emerald-500 hover:bg-[#181818] text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between text-xs text-[#FAFAFA] font-medium group-hover:text-emerald-400">
                <span>Team Collaborator</span>
                <span className="text-[9px] px-1 rounded bg-[#222222] text-[#888888] font-mono">MEMBER</span>
              </div>
              <div className="text-[11px] text-[#737373] truncate font-mono mt-0.5">
                collaborator.demo@kronos.io
              </div>
            </button>
          </div>
        </div>
      </Card>

      {/* Registration Footnote */}
      <div className="pt-2 text-center text-xs font-mono text-[#737373]">
        NEW IDENTITY REQUIRED?{' '}
        <Link
          href="/register"
          className="text-[#FAFAFA] font-semibold hover:underline underline-offset-4 ml-1"
        >
          REQUEST ENROLLMENT →
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <React.Suspense
        fallback={
          <div className="h-64 flex items-center justify-center font-mono text-xs text-[#737373]">
            INITIALIZING SECURITY GATEWAY...
          </div>
        }
      >
        <LoginForm />
      </React.Suspense>
    </AuthLayout>
  );
}
