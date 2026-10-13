'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, DocumentDetail } from '@/lib/api';
import { WorkspaceSidebar } from '@/components/documents/workspace-sidebar';
import { DocumentCanvas } from '@/components/documents/document-canvas';
import { CommandPalette } from '@/components/documents/command-palette';
import { TemplateModal } from '@/components/documents/template-modal';
import { AlertCircle } from 'lucide-react';

function DocumentEditorPageContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Command palette keyboard shortcut (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadDocument = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const res = await api.getDocument(id);
    if (res.success && res.data?.document) {
      setDocument(res.data.document);
    } else {
      setError(res.error?.message || 'Failed to load document');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocument();
  }, [id]);

  const handleNewDocument = async (folderId?: string) => {
    const res = await api.createDocument({
      title: 'Untitled',
      folderId: folderId || null,
    });
    if (res.success && res.data?.document) {
      router.push(`/documents/${res.data.document.id}`);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] animate-pulse">
        SYNCHRONIZING DOCUMENT GRAPH...
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="h-screen w-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-6 rounded-[2px] bg-[#121212] border border-[#2D2D2D] space-y-4 text-center">
          <AlertCircle className="h-8 w-8 text-[#FAFAFA] mx-auto" />
          <h2 className="text-base font-semibold text-[#FAFAFA] font-mono">
            DOCUMENT UNREACHABLE
          </h2>
          <p className="text-xs text-[#737373] leading-relaxed">
            {error || 'The requested document does not exist or access has been restricted.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/documents')}
            className="px-4 py-2 bg-[#FAFAFA] text-[#111111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold rounded-[2px]"
          >
            RETURN TO LIBRARY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#080808] flex overflow-hidden">
      {/* Collapsible Workspace Sidebar */}
      <WorkspaceSidebar
        currentDocumentId={id}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenTemplates={() => setIsTemplateModalOpen(true)}
        onNewDocument={handleNewDocument}
      />

      {/* Main Document Canvas */}
      <DocumentCanvas
        document={document}
        onRefreshDocument={loadDocument}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNewDocument={handleNewDocument}
      />

      {/* Global Template Modal */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />
    </div>
  );
}

export default function DocumentEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] animate-pulse">
          INITIALIZING WORKSPACE...
        </div>
      }
    >
      <DocumentEditorPageContent />
    </Suspense>
  );
}
