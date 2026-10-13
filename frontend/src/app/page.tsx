'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
import { BrandWordmark, BrandLogo, Button } from '@/components/ui';
import { ArrowRight, ShieldCheck, Terminal, Cpu } from 'lucide-react';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (!user.onboardingComplete) {
        router.replace('/onboarding');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#080808] text-[#FAFAFA] flex flex-col justify-between selection:bg-[#FAFAFA] selection:text-[#111111]">
      {/* Top Header */}
      <header className="p-6 sm:px-12 flex items-center justify-between border-b border-[#1F1F1F]">
        <BrandWordmark size="sm" subtitle="ARCHITECTURE LAYER" />
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">
              Enroll
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center justify-center text-center space-y-10 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-[#101010] border border-[#2D2D2D] font-mono text-[10px] text-[#A3A3A3] uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FAFAFA]" />
            SOVEREIGN CRYPTOGRAPHIC PLATFORM // 2026
          </div>

          <h1 className="text-4xl sm:text-6xl font-light tracking-tight text-[#FAFAFA] leading-[1.1]">
            Structured intelligence with absolute data sovereignty.
          </h1>

          <p className="text-base sm:text-lg text-[#737373] max-w-xl mx-auto font-light leading-relaxed">
            Engineered for high-velocity operators, technical documentation, and deep focus. Protected by continuous Argon2id verification.
          </p>
        </div>

        {/* Action Controls */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" fullWidth className="group sm:w-56">
              <span>Sign In to Kronos</span>
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href="/register" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" fullWidth className="sm:w-56">
              Create New Identity
            </Button>
          </Link>
        </div>

        {/* Technical Features Readout */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl pt-8 border-t border-[#1F1F1F] text-left font-mono">
          <div className="p-4 rounded-[2px] bg-[#101010] border border-[#222222] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#FAFAFA]">
              <Cpu className="h-3.5 w-3.5" />
              <span>ARGON2ID CORE</span>
            </div>
            <p className="text-[11px] text-[#737373]">
              64MB memory cost with 4 parallelism lanes for quantum resistance.
            </p>
          </div>

          <div className="p-4 rounded-[2px] bg-[#101010] border border-[#222222] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#FAFAFA]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>ZERO TRACKERS</span>
            </div>
            <p className="text-[11px] text-[#737373]">
              HttpOnly strict session cookies with single-use OTP recovery.
            </p>
          </div>

          <div className="p-4 rounded-[2px] bg-[#101010] border border-[#222222] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#FAFAFA]">
              <Terminal className="h-3.5 w-3.5" />
              <span>HARDENED POSTGRES</span>
            </div>
            <p className="text-[11px] text-[#737373]">
              Real database persistence with atomic transaction guarantees.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 sm:px-12 border-t border-[#1F1F1F] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[#737373]">
        <div>© 2026 KRONOS ARCHITECTURE. ALL RIGHTS RESERVED.</div>
        <div className="flex items-center gap-6">
          <span>LATENCY: 8MS</span>
          <span>LOCATION: ISOLATED CLUSTER</span>
        </div>
      </footer>
    </div>
  );
}
