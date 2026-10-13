'use client';

import React from 'react';
import Link from 'next/link';
import { BrandWordmark, BrandLogo } from './ui';
import { ShieldCheck, Cpu, Terminal, Lock } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#080808] text-[#FAFAFA] flex flex-col lg:flex-row selection:bg-[#FAFAFA] selection:text-[#111111]">
      {/* ─── Left Pane: Editorial Architectural Composition (Desktop only) ─── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-5/12 flex-col justify-between p-12 xl:p-16 border-r border-[#2D2D2D] bg-[#080808] relative overflow-hidden">
        {/* Subtle Background Grid & Noise */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-radial-vignette pointer-events-none" />

        {/* Top: Brand Header & Version Indicator */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="group transition-opacity hover:opacity-80">
            <BrandWordmark size="md" subtitle="SYSTEM 01 // ARCHITECTURE" />
          </Link>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#737373] tracking-widest uppercase border border-[#2D2D2D] px-2.5 py-1 rounded-[2px] bg-[#101010]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FAFAFA] animate-pulse" />
            NODE ONLINE
          </div>
        </div>

        {/* Center: Abstract Geometric Blueprint & Manifesto */}
        <div className="relative z-10 my-auto py-12 space-y-10 max-w-lg">
          {/* Architectural Vector Geometry */}
          <div className="p-6 border border-[#2D2D2D] bg-[#101010]/80 rounded-[4px] relative">
            {/* Corner Crosshairs */}
            <div className="absolute -top-1.5 -left-1.5 text-[#505050] font-mono text-xs">+</div>
            <div className="absolute -top-1.5 -right-1.5 text-[#505050] font-mono text-xs">+</div>
            <div className="absolute -bottom-1.5 -left-1.5 text-[#505050] font-mono text-xs">+</div>
            <div className="absolute -bottom-1.5 -right-1.5 text-[#505050] font-mono text-xs">+</div>

            <div className="flex items-center justify-between border-b border-[#222222] pb-3 mb-4 font-mono text-[11px] text-[#737373]">
              <span className="flex items-center gap-1.5 text-[#FAFAFA]">
                <Cpu className="h-3.5 w-3.5" /> SPECIFICATION 2026.4
              </span>
              <span>ZERO-LEAKAGE MEMORY</span>
            </div>

            <div className="space-y-2 font-mono text-xs text-[#A3A3A3]">
              <div className="flex justify-between">
                <span>HASHING ALGORITHM</span>
                <span className="text-[#FAFAFA]">ARGON2ID (m=64MB, t=3, p=4)</span>
              </div>
              <div className="flex justify-between">
                <span>SESSION ENCRYPTION</span>
                <span className="text-[#FAFAFA]">AES-GCM // HTTPONLY RECOVERY</span>
              </div>
              <div className="flex justify-between">
                <span>RECOVERY ATTEMPT POLICY</span>
                <span className="text-[#FAFAFA]">5 STRIKES // TIME-LOCKED OTP</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#222222] flex items-center justify-between text-[10px] font-mono text-[#737373]">
              <span>ISOLATION: STRICT</span>
              <span className="text-[#FAFAFA]">AUTHENTICATED CHANNELS</span>
            </div>
          </div>

          {/* Editorial Manifesto Statement */}
          <div className="space-y-4">
            <h2 className="text-2xl xl:text-3xl font-light tracking-tight text-[#FAFAFA] leading-snug">
              Sovereign architecture engineered for deep focus, structured intelligence, and absolute security.
            </h2>
            <p className="text-sm text-[#737373] leading-relaxed">
              Every cryptographic boundary is verified continuously. Your workspaces, memory graphs, and notes remain under your exclusive custody.
            </p>
          </div>
        </div>

        {/* Bottom: Technical Telemetry Footer */}
        <div className="relative z-10 pt-6 border-t border-[#222222] flex items-center justify-between text-[11px] font-mono text-[#737373]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#FAFAFA]" />
            <span>AUTHENTICATION ENGINE 4.2</span>
          </div>
          <span>LATENCY: &lt;12ms</span>
        </div>
      </div>

      {/* ─── Right Pane: Focused Form Container ─── */}
      <div className="flex-1 flex flex-col justify-between min-h-screen">
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="lg:hidden flex items-center justify-between p-6 border-b border-[#2D2D2D] bg-[#080808]">
          <Link href="/">
            <BrandWordmark size="sm" subtitle="SECURITY LAYER" />
          </Link>
          <div className="font-mono text-[9px] text-[#737373] uppercase border border-[#2D2D2D] px-2 py-0.5 rounded-[2px]">
            SYSTEM 01
          </div>
        </header>

        {/* Centered Form Body */}
        <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-16">
          <div className="w-full max-w-[420px] space-y-6 animate-slide-up">
            {children}
          </div>
        </main>

        {/* Elegant Minimal Footer */}
        <footer className="p-6 sm:px-10 border-t border-[#1F1F1F] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#737373]">
          <div>
            © 2026 KRONOS ARCHITECTURE. ALL RIGHTS RESERVED.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-[#FAFAFA] transition-colors">
              SECURITY PROTOCOL
            </Link>
            <Link href="/" className="hover:text-[#FAFAFA] transition-colors">
              LEGAL TERMS
            </Link>
            <Link href="/" className="hover:text-[#FAFAFA] transition-colors">
              SYSTEM AUDIT
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
