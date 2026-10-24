'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthLayout from '@/components/auth-layout';
import {
  Button,
  Input,
  PasswordInput,
  PasswordStrengthMeter,
  Card,
  Alert,
  Checkbox,
} from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { Shield, ArrowRight, CheckCircle2, UserCheck } from 'lucide-react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const redirectParam = searchParams.get('redirect') || '';

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const { register } = useAuth();

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!displayName.trim()) {
      errors.displayName = 'Full legal or operator name is required';
    }

    if (!email.trim()) {
      errors.email = 'Valid corporate or personal email required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please provide a valid email format';
    }

    if (!password) {
      errors.password = 'Password key required';
    } else if (password.length < 8) {
      errors.password = 'Must satisfy minimum length of 8 characters';
    } else if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
      errors.password = 'Must contain uppercase, number, and special character';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptedTerms) {
      errors.terms = 'Agreement to the protocol and security terms is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });

      if (result.success) {
        setIsSuccess(true);
      } else {
        if (result.error?.toLowerCase().includes('already') || result.error?.toLowerCase().includes('exists')) {
          setFieldErrors((prev) => ({
            ...prev,
            email: 'An account with this email identity is already registered',
          }));
        } else {
          setError(result.error || 'Failed to complete security enrollment');
        }
      }
    } catch {
      setError('An unexpected network communication error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout>
        <div className="space-y-8 animate-fade-in">
          <div className="space-y-2 text-center">
            <div className="inline-flex p-3 rounded-full bg-[#151515] border border-[#2D2D2D] text-[#FAFAFA] mb-2">
              <CheckCircle2 className="h-6 w-6 stroke-[1.5]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
              Enrollment Created
            </h1>
            <p className="text-sm text-[#737373]">
              Your cryptographic identity is initialized for{' '}
              <span className="text-[#FAFAFA] font-mono">{email}</span>.
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <div className="p-4 rounded-[var(--radius-sm)] bg-[#101010] border border-[#222222] font-mono text-xs text-[#A3A3A3] space-y-2">
              <div className="flex justify-between">
                <span>IDENTITY:</span>
                <span className="text-[#FAFAFA]">{displayName}</span>
              </div>
              <div className="flex justify-between">
                <span>SECURITY LEVEL:</span>
                <span className="text-[#FAFAFA]">SOVEREIGN ACCESS</span>
              </div>
              <div className="flex justify-between">
                <span>VERIFICATION:</span>
                <span className="text-[#FAFAFA]">INBOX DISPATCHED</span>
              </div>
            </div>

            <p className="text-xs text-[#737373] leading-relaxed">
              A verification dispatch was routed to your email address. You may proceed immediately to your dashboard workspace.
            </p>

            <div className="space-y-2.5 pt-2">
              {redirectParam ? (
                <>
                  <Button fullWidth size="lg" onClick={() => router.push(redirectParam)}>
                    Proceed to Invitation & Claim Access →
                  </Button>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="w-full py-2.5 bg-transparent border border-[#2D2D2D] text-[#A3A3A3] hover:text-[#FAFAFA] font-mono text-xs uppercase"
                  >
                    Go to Dashboard Instead
                  </button>
                </>
              ) : (
                <Button fullWidth size="lg" onClick={() => router.push('/dashboard')}>
                  Access Dashboard Workspace
                </Button>
              )}
              <Link href="/login" className="block text-center text-xs font-mono text-[#737373] hover:text-[#FAFAFA] pt-1">
                RETURN TO SIGN IN
              </Link>
            </div>
          </Card>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-8">
        {/* Form Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#737373]">
            <Shield className="h-3 w-3 text-[#FAFAFA]" />
            <span>IDENTITY ENROLLMENT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
            Create Kronos Account
          </h1>
          <p className="text-sm text-[#737373]">
            Establish a sovereign cryptographic workspace with private credentials.
          </p>
        </div>

        {/* Registration Card */}
        <Card variant="default" className="p-6 sm:p-7 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <Alert
                type="error"
                title="ENROLLMENT REJECTED"
                message={error}
                onDismiss={() => setError('')}
              />
            )}

            <Input
              id="register-name"
              label="Full Name / Operator"
              sublabel="PUBLIC IDENTIFIER"
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, displayName: '' }));
              }}
              placeholder="Cheran A."
              error={fieldErrors.displayName}
              autoFocus
              disabled={isLoading}
            />

            <Input
              id="register-email"
              label="Email Address"
              sublabel="CORPORATE OR PERSONAL"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholder="operator@kronos.io"
              error={fieldErrors.email}
              autoComplete="email"
              disabled={isLoading}
            />

            <div className="space-y-2">
              <PasswordInput
                id="register-password"
                label="Master Passphrase"
                sublabel="MINIMUM 8 CHARACTERS"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Enter a hardened passphrase"
                error={fieldErrors.password}
                autoComplete="new-password"
                disabled={isLoading}
              />

              {password && <PasswordStrengthMeter password={password} />}
            </div>

            <PasswordInput
              id="register-confirm-password"
              label="Confirm Passphrase"
              sublabel="MATCH VERIFICATION"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
              }}
              placeholder="Repeat your passphrase"
              error={fieldErrors.confirmPassword}
              autoComplete="new-password"
              disabled={isLoading}
            />

            <div className="pt-1">
              <Checkbox
                id="register-terms"
                label={
                  <span>
                    I accept the{' '}
                    <span className="text-[#FAFAFA] underline underline-offset-2">
                      Sovereign Cryptographic Terms
                    </span>{' '}
                    and Privacy Protocol
                  </span>
                }
                checked={acceptedTerms}
                onChange={(checked) => {
                  setAcceptedTerms(checked);
                  setFieldErrors((prev) => ({ ...prev, terms: '' }));
                }}
                disabled={isLoading}
              />
              {fieldErrors.terms && (
                <p className="text-xs text-[#E5E5E5] pt-1.5 font-mono">{fieldErrors.terms}</p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                fullWidth
                size="lg"
                isLoading={isLoading}
                className="group"
              >
                <span>Authorize & Create Account</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
          </form>
        </Card>

        {/* Return to Login Footer */}
        <div className="pt-2 text-center text-xs font-mono text-[#737373]">
          ALREADY ENROLLED?{' '}
          <Link
            href={`/login${redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''}`}
            className="text-[#FAFAFA] font-semibold hover:underline underline-offset-4 ml-1"
          >
            SIGN IN TO KRONOS →
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] animate-pulse">
          INITIALIZING SECURE ENROLLMENT...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
