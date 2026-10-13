'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthLayout from '@/components/auth-layout';
import {
  Button,
  Input,
  PasswordInput,
  PasswordStrengthMeter,
  OtpInput,
  Card,
  Alert,
} from '@/components/ui';
import { api } from '@/lib/api';
import { KeyRound, ShieldCheck, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';

type Step = 'REQUEST_CODE' | 'VERIFY_OTP' | 'SET_NEW_PASSWORD' | 'SUCCESS';

export default function ForgotPasswordPage() {
  const router = useRouter();

  // State
  const [step, setStep] = useState<Step>('REQUEST_CODE');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetAuthToken, setResetAuthToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Timing
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState(15 * 60); // 15 mins in seconds

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Expiration timer during OTP verification
  useEffect(() => {
    if (step !== 'VERIFY_OTP') return;
    const interval = setInterval(() => {
      setOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Format countdown mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Step 1: Request Code ──────────────────────────────────────────────────
  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldErrors({ email: 'Please provide a valid email identifier' });
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.forgotPassword(email.trim());
      if (result.success) {
        setStep('VERIFY_OTP');
        setResendCooldown(60);
        setOtpExpiresIn(15 * 60);
      } else {
        setError(result.error?.message || 'Failed to dispatch recovery code.');
      }
    } catch {
      setError('Communication error with authentication cluster.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    setError('');

    if (code.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.verifyResetOtp(email.trim(), code);
      if (result.success && result.data?.resetAuthToken) {
        setResetAuthToken(result.data.resetAuthToken);
        setStep('SET_NEW_PASSWORD');
      } else {
        setError(result.error?.message || 'Invalid or expired verification code.');
      }
    } catch {
      setError('Network communication failed during OTP verification.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 3: Set New Password ──────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('New passphrase must contain at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passphrases do not match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.resetPassword({
        token: resetAuthToken,
        password,
        confirmPassword,
      });

      if (result.success) {
        setStep('SUCCESS');
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(result.error?.message || 'Failed to update credentials.');
      }
    } catch {
      setError('Communication error while updating credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-8 animate-fade-in">
        {/* ─── STAGE 1: Request Code ───────────────────────────────────────── */}
        {step === 'REQUEST_CODE' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#737373]">
                <KeyRound className="h-3 w-3 text-[#FAFAFA]" />
                <span>CREDENTIAL RECOVERY // STEP 1</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
                Recover Access
              </h1>
              <p className="text-sm text-[#737373]">
                Enter your account email to receive a single-use 6-digit verification code.
              </p>
            </div>

            <Card className="p-6 sm:p-7 space-y-5">
              <form onSubmit={handleRequestCode} className="space-y-4" noValidate>
                {error && (
                  <Alert
                    type="error"
                    title="REQUEST FAILED"
                    message={error}
                    onDismiss={() => setError('')}
                  />
                )}

                <Input
                  id="recovery-email"
                  label="Email Identity"
                  sublabel="DESTINATION FOR OTP"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors({});
                  }}
                  placeholder="operator@kronos.io"
                  error={fieldErrors.email}
                  autoComplete="email"
                  autoFocus
                  disabled={isLoading}
                />

                <div className="pt-2">
                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    isLoading={isLoading}
                    className="group"
                  >
                    <span>Dispatch Recovery Code</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
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
          </>
        )}

        {/* ─── STAGE 2: OTP Verification ───────────────────────────────────── */}
        {step === 'VERIFY_OTP' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#737373]">
                  <ShieldCheck className="h-3 w-3 text-[#FAFAFA]" />
                  <span>STEP 2 // VERIFY OTP</span>
                </div>
                <div className="font-mono text-xs text-[#FAFAFA] bg-[#151515] px-2 py-0.5 border border-[#2D2D2D] rounded-[2px]">
                  {formatTimer(otpExpiresIn)}
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
                Security Verification
              </h1>
              <p className="text-sm text-[#737373]">
                Enter the 6-digit code sent to <span className="text-[#FAFAFA] font-mono">{email}</span>.
              </p>
            </div>

            <Card className="p-6 sm:p-7 space-y-6">
              {error && (
                <Alert
                  type="error"
                  title="VERIFICATION REJECTED"
                  message={error}
                  onDismiss={() => setError('')}
                />
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-[#737373]">
                  <span>ENTER 6-DIGIT CODE</span>
                  <span>TIME-LOCKED</span>
                </div>
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={(completedCode) => handleVerifyOtp(completedCode)}
                  disabled={isLoading || otpExpiresIn <= 0}
                />
              </div>

              <div className="pt-2 space-y-3">
                <Button
                  fullWidth
                  size="lg"
                  isLoading={isLoading}
                  onClick={() => handleVerifyOtp()}
                  disabled={otp.length !== 6 || otpExpiresIn <= 0}
                >
                  Confirm Verification Code
                </Button>

                <div className="flex items-center justify-between text-xs font-mono pt-1">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isLoading}
                    onClick={() => handleRequestCode()}
                    className="text-[#737373] hover:text-[#FAFAFA] disabled:opacity-40 disabled:hover:text-[#737373] transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin-slow' : ''}`} />
                    {resendCooldown > 0 ? `RESEND CODE (${resendCooldown}s)` : 'RESEND CODE'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('REQUEST_CODE')}
                    className="text-[#737373] hover:text-[#FAFAFA] transition-colors"
                  >
                    CHANGE EMAIL
                  </button>
                </div>
              </div>
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
          </>
        )}

        {/* ─── STAGE 3: Set New Password ───────────────────────────────────── */}
        {step === 'SET_NEW_PASSWORD' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#737373]">
                <KeyRound className="h-3 w-3 text-[#FAFAFA]" />
                <span>STEP 3 // NEW PASSPHRASE</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
                Reset Passphrase
              </h1>
              <p className="text-sm text-[#737373]">
                Configure a new cryptographic secret key for your account.
              </p>
            </div>

            <Card className="p-6 sm:p-7 space-y-5">
              <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
                {error && (
                  <Alert
                    type="error"
                    title="UPDATE REJECTED"
                    message={error}
                    onDismiss={() => setError('')}
                  />
                )}

                <div className="space-y-2">
                  <PasswordInput
                    id="new-password"
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
                  id="confirm-new-password"
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
                    Authorize & Update Passphrase
                  </Button>
                </div>
              </form>
            </Card>
          </>
        )}

        {/* ─── STAGE 4: Success Confirmation ───────────────────────────────── */}
        {step === 'SUCCESS' && (
          <div className="space-y-6 text-center animate-fade-in">
            <div className="inline-flex p-3 rounded-full bg-[#151515] border border-[#2D2D2D] text-[#FAFAFA]">
              <CheckCircle2 className="h-8 w-8 stroke-[1.5]" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
                Credentials Updated
              </h1>
              <p className="text-sm text-[#737373]">
                Your master passphrase was updated and all prior sessions were revoked for security.
              </p>
            </div>

            <Card className="p-6 space-y-4">
              <p className="text-xs font-mono text-[#A3A3A3]">
                REDIRECTING TO SECURITY GATEWAY IN 3 SECONDS...
              </p>
              <Button fullWidth size="lg" onClick={() => router.push('/login')}>
                Sign In Now
              </Button>
            </Card>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
