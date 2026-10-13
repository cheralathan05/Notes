'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  X,
  Sparkles,
  Folder,
  Tag,
  Check,
  RefreshCw,
  ArrowRight,
  Link as LinkIcon,
  FileText,
} from 'lucide-react';
import { api, FolderItem } from '@/lib/api';

interface UniversalQuickCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UniversalQuickCapture({
  isOpen,
  onClose,
  onSuccess,
}: UniversalQuickCaptureProps) {
  const router = useRouter();

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [tags, setTags] = useState<string>('inbox, quick-capture');
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load folders
  useEffect(() => {
    if (isOpen) {
      setContent('');
      setTitle('');
      setError(null);
      setSaveSuccess(false);
      api.listFolders().then((res) => {
        if (res.success && res.data?.folders) {
          setFolders(res.data.folders);
        }
      });
    }
  }, [isOpen]);

  // AI Infer Title and Tags
  const handleAiInfer = async () => {
    if (!content.trim()) return;
    setIsAiProcessing(true);
    setError(null);
    try {
      const res = await api.aiTransform({
        action: 'summarize',
        text: content,
      });

      if (res.success && res.data?.result) {
        // Derive title from first line of summary
        const summary = res.data.result.trim();
        const derivedTitle = summary.split('\n')[0].replace(/^#*\s*/, '').slice(0, 50);
        setTitle(derivedTitle || 'Quick Idea');
      } else {
        // Fallback
        const firstWords = content.trim().split('\n')[0].slice(0, 40);
        setTitle(firstWords || 'Quick Capture Note');
      }
    } catch {
      setTitle(content.trim().split('\n')[0].slice(0, 40) || 'Quick Note');
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Save Document
  const handleSave = async (openImmediately = false) => {
    const finalContent = content.trim();
    if (!finalContent) {
      setError('Please enter note content or an idea');
      return;
    }

    setIsSaving(true);
    setError(null);

    const docTitle = title.trim() || finalContent.split('\n')[0].slice(0, 45) || 'Quick Note';

    try {
      const res = await api.createDocument({
        title: docTitle,
        folderId: selectedFolder || null,
        icon: '⚡',
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: docTitle }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: finalContent }],
            },
          ],
        },
      });

      if (res.success && res.data?.document) {
        setSaveSuccess(true);
        if (onSuccess) onSuccess();

        if (openImmediately) {
          router.push(`/documents/${res.data.document.id}`);
          onClose();
        } else {
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else {
        setError(res.error?.message || 'Failed to save note');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error saving quick note');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="w-full max-w-lg bg-[#0F0F0F] border border-[#2D2D2D] shadow-2xl p-5 space-y-4 animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-capture-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#202020] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#1A1A1A] border border-[#2A2A2A]">
              <Zap className="h-4 w-4 text-[#FAFAFA]" />
            </div>
            <div>
              <h2
                id="quick-capture-title"
                className="font-mono text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider"
              >
                UNIVERSAL QUICK CAPTURE
              </h2>
              <span className="font-mono text-[10px] text-[#737373]">
                SHORTCUT: CTRL+SHIFT+C
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#737373] hover:text-[#FAFAFA] p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="space-y-3">
          <div>
            <textarea
              autoFocus
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Jot down a thought, paste a link, meeting highlight, or snippet..."
              className="w-full p-3 bg-[#141414] border border-[#262626] text-xs text-[#FAFAFA] placeholder-[#555555] font-sans focus:outline-none focus:border-[#737373] resize-none"
            />
          </div>

          {/* Title & AI suggestion */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Note title (leave empty for auto-title)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-[#141414] border border-[#262626] text-xs text-[#FAFAFA] placeholder-[#555555] font-mono focus:outline-none focus:border-[#737373]"
            />
            <button
              type="button"
              disabled={isAiProcessing || !content.trim()}
              onClick={handleAiInfer}
              className="px-2.5 py-1.5 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333333] font-mono text-[11px] text-[#A3A3A3] hover:text-[#FAFAFA] flex items-center gap-1 disabled:opacity-40 transition-colors shrink-0"
              title="Infer title and tags from content"
            >
              {isAiProcessing ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 text-[#FAFAFA]" />
              )}
              <span>AI INFER</span>
            </button>
          </div>

          {/* Folder & Tags selection */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5 bg-[#141414] border border-[#262626] px-2.5 py-1">
              <Folder className="h-3.5 w-3.5 text-[#737373] shrink-0" />
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full bg-transparent text-xs text-[#FAFAFA] font-mono focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#141414] text-[#A3A3A3]">
                  ROOT (NO FOLDER)
                </option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id} className="bg-[#141414] text-[#FAFAFA]">
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-[#141414] border border-[#262626] px-2.5 py-1">
              <Tag className="h-3.5 w-3.5 text-[#737373] shrink-0" />
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tags (comma separated)"
                className="w-full bg-transparent text-xs text-[#FAFAFA] font-mono placeholder-[#555] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-2 bg-[#1C1111] border border-[#3A1F1F] font-mono text-[11px] text-[#E57373]">
            {error}
          </div>
        )}

        {saveSuccess && (
          <div className="p-2 bg-[#112211] border border-[#224422] font-mono text-[11px] text-[#81C784] flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            <span>NOTE PERSISTED TO KRONOS SOVEREIGN REPOSITORY</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-[#202020] flex items-center justify-between">
          <span className="font-mono text-[10px] text-[#555555]">
            SAVES IN SECONDS
          </span>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(false)}
              className="px-3.5 py-1.5 bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#333333] text-[#FAFAFA] font-semibold transition-colors disabled:opacity-40"
            >
              {isSaving ? 'SAVING...' : 'SAVE NOTE'}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(true)}
              className="px-4 py-1.5 bg-[#FAFAFA] hover:bg-[#E5E5E5] text-[#111111] font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
            >
              <span>SAVE & OPEN</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
