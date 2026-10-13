'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthLayout from '@/components/auth-layout';
import { Button, Card, Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      setIsLoading(true);
      api.verifyEmail(token)
        .then((result) => {
          if (result.success) {
            setSuccess(true);
          } else {
            setError(result.error?.message || 'Verification token is invalid or has expired.');
          }
        })
        .catch(() => {
          setError('An unexpected communication error occurred.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [token]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#737373]">
          <ShieldCheck className="h-3 w-3 text-[#FAFAFA]" />
          <span>EMAIL AUTHORIZATION PROTOCOL</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#FAFAFA]">
          Identity Verification
        </h1>
        <p className="text-sm text-[#737373]">
          {token
            ? 'Confirming cryptographic signature from verification link.'
            : 'Check your inbox for your security authorization dispatch.'}
        </p>
      </div>

      <Card className="p-6 sm:p-7 space-y-5">
        {isLoading && (
          <div className="p-8 text-center font-mono text-xs text-[#737373]">
            VERIFYING SIGNATURE TOKEN...
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <Alert type="error" title="VERIFICATION FAILED" message={error} />
            <Link href="/login" className="block">
              <Button variant="outline" fullWidth size="md">
                Return to Sign In
              </Button>
            </Link>
          </div>
        )}

        {success && (
          <div className="space-y-5 text-center">
            <div className="inline-flex p-3 rounded-full bg-[#151515] border border-[#2D2D2D] text-[#FAFAFA]">
              <CheckCircle2 className="h-7 w-7 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#FAFAFA]">
                Email Authorization Confirmed
              </h2>
              <p className="text-xs text-[#737373]">
                Your identity has been cryptographically validated in our sovereign registry.
              </p>
            </div>
            <Link href="/dashboard" className="block pt-2">
              <Button fullWidth size="lg">
                Enter Sovereign Workspace
              </Button>
            </Link>
          </div>
        )}

        {!token && !isLoading && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              A verification dispatch was routed to your registered email address. Open the message and activate the token to elevate your security clearance.
            </p>
            <Link href="/dashboard" className="block pt-2">
              <Button fullWidth size="lg" className="group">
                <span>Proceed to Workspace</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <React.Suspense
        fallback={
          <div className="h-64 flex items-center justify-center font-mono text-xs text-[#737373]">
            LOADING SECURITY GATEWAY...
          </div>
        }
      >
        <VerifyEmailForm />
      </React.Suspense>
    </AuthLayout>
  );
}
