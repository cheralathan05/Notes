'use client';

import React, { useState, useEffect } from 'react';
import { History, RotateCcw, X, Clock, User, Check } from 'lucide-react';
import { api, RevisionItem, RevisionDetail } from '@/lib/api';

interface RevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  onRestored: () => void;
}

export function RevisionModal({
  isOpen,
  onClose,
  documentId,
  onRestored,
}: RevisionModalProps) {
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<RevisionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.listRevisions(documentId).then((res) => {
        if (res.success && res.data?.revisions) {
          setRevisions(res.data.revisions);
          if (res.data.revisions.length > 0) {
            loadRevisionContent(res.data.revisions[0].id);
          }
        }
        setLoading(false);
      });
    }
  }, [isOpen, documentId]);

  const loadRevisionContent = async (revId: string) => {
    const res = await api.getRevision(documentId, revId);
    if (res.success && res.data?.revision) {
      setSelectedRevision(res.data.revision);
    }
  };

  const handleRestore = async () => {
    if (!selectedRevision) return;
    setRestoring(true);
    const res = await api.restoreRevision(documentId, selectedRevision.id);
    setRestoring(false);
    if (res.success) {
      onRestored();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="w-full max-w-3xl h-[600px] rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#222222] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#FAFAFA]" />
            <h3 className="font-mono text-sm font-semibold text-[#FAFAFA] uppercase tracking-wider">
              DOCUMENT REVISION TIMELINE
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#737373] hover:text-[#FAFAFA] p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body: Left Timeline list, Right Content Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Revisions List */}
          <div className="w-72 border-r border-[#222222] overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="p-4 text-center font-mono text-xs text-[#737373] animate-pulse">
                RETRIEVING SNAPSHOTS...
              </div>
            ) : revisions.length === 0 ? (
              <div className="p-4 text-center font-mono text-xs text-[#505050]">
                NO PRIOR REVISIONS
              </div>
            ) : (
              revisions.map((rev) => {
                const isSelected = selectedRevision?.id === rev.id;
                return (
                  <button
                    key={rev.id}
                    type="button"
                    onClick={() => loadRevisionContent(rev.id)}
                    className={`w-full text-left p-2.5 rounded-[2px] transition-colors border ${
                      isSelected
                        ? 'bg-[#181818] border-[#333333] text-[#FAFAFA]'
                        : 'border-transparent text-[#A3A3A3] hover:bg-[#141414]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#FAFAFA]">
                        v{rev.version}
                      </span>
                      <span className="font-mono text-[10px] text-[#737373]">
                        {new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#D4D4D4] truncate mt-1">
                      {rev.description || rev.title}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5 font-mono text-[10px] text-[#737373]">
                      <User className="h-3 w-3" />
                      <span className="truncate">{rev.creator.displayName}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Snapshot Preview */}
          <div className="flex-1 flex flex-col bg-[#0A0A0A]">
            <div className="p-3 border-b border-[#1F1F1F] flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] text-[#737373] uppercase">
                  SNAPSHOT PREVIEW
                </span>
                <div className="text-xs font-medium text-[#FAFAFA]">
                  {selectedRevision?.title || 'Untitled'}
                </div>
              </div>

              {selectedRevision && (
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={restoring}
                  className="px-3 py-1.5 rounded-[2px] bg-[#FAFAFA] text-[#111111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{restoring ? 'RESTORING...' : 'RESTORE VERSION'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 p-6 overflow-y-auto text-xs text-[#E5E5E5] leading-relaxed font-mono whitespace-pre-wrap select-text">
              {selectedRevision ? (
                typeof selectedRevision.content === 'object' ? (
                  JSON.stringify(selectedRevision.content, null, 2)
                ) : (
                  String(selectedRevision.content)
                )
              ) : (
                <div className="text-[#505050]">Select a revision on the left to preview.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#222222] bg-[#0A0A0A] flex items-center justify-between font-mono text-[10px] text-[#505050]">
          <span>OPTIMISTIC CONCURRENCY PROTECTION (OCC)</span>
          <span>ROLLBACK SAFE</span>
        </div>
      </div>
    </div>
  );
}
