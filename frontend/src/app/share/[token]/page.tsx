'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { BrandWordmark } from '@/components/ui';
import { Globe, Printer, ShieldCheck, Lock, FileText } from 'lucide-react';
import { api, DocumentDetail } from '@/lib/api';

function PublicDocumentSharePageContent() {
  const params = useParams();
  const token = params?.token as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    api.getPublicDocument(token).then((res) => {
      if (res.success && res.data?.document) {
        setDocument(res.data.document);
      } else {
        setError(res.error?.message || 'Shared document unreachable or link has expired.');
      }
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] animate-pulse">
        VALIDATING CRYPTOGRAPHIC SHARE TOKEN...
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="h-screen w-screen bg-[#080808] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-[2px] bg-[#121212] border border-[#2D2D2D] text-center space-y-4">
          <Lock className="h-8 w-8 text-[#FAFAFA] mx-auto" />
          <h2 className="text-base font-semibold text-[#FAFAFA] font-mono">
            ACCESS RESTRICTED
          </h2>
          <p className="text-xs text-[#737373] leading-relaxed">
            {error || 'This shared document link is invalid or has been revoked by the owner.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#FAFAFA] flex flex-col selection:bg-[#FAFAFA] selection:text-[#111111]">
      {/* ─── Top Public Header ─── */}
      <header className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur-md border-b border-[#222222] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandWordmark size="sm" subtitle="PUBLIC SHARE" />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-[2px] bg-[#151515] hover:bg-[#202020] text-[#FAFAFA] border border-[#2D2D2D] font-mono text-xs flex items-center gap-1.5 transition-colors"
            >
              <Printer className="h-3.5 w-3.5 text-[#737373]" />
              <span>PRINT / PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Document Reading Canvas ─── */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 space-y-8">
        {/* Title Header */}
        <div className="space-y-3 pb-6 border-b border-[#1C1C1C]">
          <span className="text-4xl">{document.icon || '📄'}</span>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-[#FAFAFA]">
            {document.title}
          </h1>
          <div className="flex items-center gap-4 font-mono text-xs text-[#737373]">
            <span>AUTHOR: {document.creator?.displayName || 'OPERATOR'}</span>
            <span>UPDATED: {new Date(document.updatedAt).toLocaleDateString()}</span>
            <span className="px-1.5 py-0.5 rounded-[2px] bg-[#151515] border border-[#262626] text-[#FAFAFA]">
              VERIFIED RELEASE
            </span>
          </div>
        </div>

        {/* Content Render (Clean structured text & blocks) */}
        <article className="ProseMirror select-text">
          {typeof document.content === 'object' && document.content?.content ? (
            document.content.content.map((node: any, idx: number) => {
              if (node.type === 'heading') {
                const text = node.content?.map((c: any) => c.text).join('') || '';
                if (node.attrs?.level === 1) return <h1 key={idx}>{text}</h1>;
                if (node.attrs?.level === 2) return <h2 key={idx}>{text}</h2>;
                return <h3 key={idx}>{text}</h3>;
              }
              if (node.type === 'paragraph') {
                const text = node.content?.map((c: any) => c.text).join('') || '';
                return <p key={idx}>{text}</p>;
              }
              if (node.type === 'bulletList') {
                return (
                  <ul key={idx}>
                    {node.content?.map((li: any, lIdx: number) => (
                      <li key={lIdx}>{li.content?.[0]?.content?.map((c: any) => c.text).join('') || ''}</li>
                    ))}
                  </ul>
                );
              }
              if (node.type === 'blockquote') {
                const text = node.content?.map((c: any) => c.content?.[0]?.text).join('') || '';
                return <blockquote key={idx}>{text}</blockquote>;
              }
              return null;
            })
          ) : (
            <p>{document.plainText || 'Document content unavailable.'}</p>
          )}
        </article>
      </main>

      {/* ─── Public Footer ─── */}
      <footer className="border-t border-[#1F1F1F] py-6 text-center font-mono text-xs text-[#505050]">
        POWERED BY KRONOS SOVEREIGN PRODUCTIVITY & AI WORKSPACE
      </footer>
    </div>
  );
}

export default function PublicDocumentSharePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] animate-pulse">
          VALIDATING SHARE TOKEN...
        </div>
      }
    >
      <PublicDocumentSharePageContent />
    </Suspense>
  );
}
