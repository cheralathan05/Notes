'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

import {
  Star,
  Pin,
  Share2,
  Download,
  History,
  Sparkles,
  Trash2,
  Copy,
  ChevronRight,
  Smile,
  ImageIcon,
  MoreVertical,
  Maximize,
  Minimize,
  Save,
  ListTree,
  Search,
  Activity,
  Zap,
} from 'lucide-react';

import { api, DocumentDetail } from '@/lib/api';
import { EditorToolbar } from './editor-toolbar';
import { AiAssistantPanel } from './ai-assistant-panel';
import { RevisionModal } from './revision-modal';
import { ShareModal } from './share-modal';
import { ExportModal } from './export-modal';
import { FindReplace } from './find-replace';
import { TableOfContents } from './table-of-contents';
import { ActivityModal } from './activity-modal';
import { SlashCommandMenu } from './slash-command';
import { UniversalQuickCapture } from './universal-quick-capture';

interface DocumentCanvasProps {
  document: DocumentDetail;
  onRefreshDocument: () => void;
}

export function DocumentCanvas({
  document: initialDoc,
  onRefreshDocument,
}: DocumentCanvasProps) {
  const router = useRouter();

  const [document, setDocument] = useState<DocumentDetail>(initialDoc);
  const [title, setTitle] = useState(initialDoc.title);
  const [icon, setIcon] = useState(initialDoc.icon || '📄');
  const [coverImage, setCoverImage] = useState(initialDoc.coverImage);
  const [isFullWidth, setIsFullWidth] = useState(initialDoc.isFullWidth);
  const [isFavorite, setIsFavorite] = useState(initialDoc.isFavorite);
  const [isPinned, setIsPinned] = useState(initialDoc.isPinned);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'>('saved');
  const [version, setVersion] = useState(initialDoc.version);

  // Panels & Modals
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [distractionFree, setDistractionFree] = useState(false);

  // Universal Quick Capture shortcut (Ctrl+Shift+C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setIsQuickCaptureOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce timer for autosave
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const iconsList = ['📄', '📝', '📋', '📁', '💡', '🔬', '📊', '⚙️', '👥', '🎯', '📓', '📚', '⚡', '🔒', '🛡️'];

  // Initialize TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands or start writing...",
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: initialDoc.content,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[500px]',
      },
    },
    onUpdate: ({ editor: ed }) => {
      setSaveStatus('unsaved');
      triggerDebouncedSave();

      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 2), from, '\n');
      if (textBefore.endsWith('/')) {
        setIsSlashMenuOpen(true);
      } else {
        setIsSlashMenuOpen(false);
      }
    },
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFindReplaceOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keep state synced when initialDoc changes
  useEffect(() => {
    setDocument(initialDoc);
    setTitle(initialDoc.title);
    setIcon(initialDoc.icon || '📄');
    setCoverImage(initialDoc.coverImage);
    setIsFullWidth(initialDoc.isFullWidth);
    setIsFavorite(initialDoc.isFavorite);
    setIsPinned(initialDoc.isPinned);
    setVersion(initialDoc.version);
    if (editor && !editor.isFocused) {
      editor.commands.setContent(initialDoc.content);
    }
  }, [initialDoc.id]);

  // Autosave core persistence method
  const performSave = useCallback(
    async (manualTitle?: string, manualContent?: any) => {
      if (!editor) return;

      const currentContent = manualContent !== undefined ? manualContent : editor.getJSON();
      const currentTitle = manualTitle !== undefined ? manualTitle : title;

      setSaveStatus('saving');

      try {
        const res = await api.updateDocument(document.id, {
          clientVersion: version,
          title: currentTitle,
          content: currentContent,
          icon,
          coverImage,
          isFullWidth,
          isFavorite,
          isPinned,
        });

        if (res.success && res.data?.document) {
          setVersion(res.data.document.version);
          setSaveStatus('saved');
        } else if (res.error?.code === 'CONCURRENCY_CONFLICT') {
          setSaveStatus('conflict');
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      }
    },
    [document.id, editor, version, title, icon, coverImage, isFullWidth, isFavorite, isPinned]
  );

  const triggerDebouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 750);
  }, [performSave]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setSaveStatus('unsaved');
    triggerDebouncedSave();
  };

  const handleToggleFavorite = async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    await api.updateDocument(document.id, { isFavorite: next });
  };

  const handleTogglePin = async () => {
    const next = !isPinned;
    setIsPinned(next);
    await api.updateDocument(document.id, { isPinned: next });
  };

  const handleToggleFullWidth = async () => {
    const next = !isFullWidth;
    setIsFullWidth(next);
    await api.updateDocument(document.id, { isFullWidth: next });
  };

  const handleTrashDocument = async () => {
    if (window.confirm('Move this document to trash?')) {
      const res = await api.trashDocument(document.id);
      if (res.success) {
        router.push('/documents');
      }
    }
  };

  const handleDuplicate = async () => {
    const res = await api.duplicateDocument(document.id);
    if (res.success && res.data?.document) {
      router.push(`/documents/${res.data.document.id}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const res = await api.uploadAttachment(document.id, file);
    if (res.success && res.data?.attachment?.url) {
      const fullUrl = `http://localhost:4000${res.data.attachment.url}`;
      editor.chain().focus().setImage({ src: fullUrl, alt: file.name }).run();
    }
  };

  // Stats calculation
  const textContent = editor?.getText() || '';
  const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
  const charCount = textContent.length;

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: '#f0f4f9' }}>
      {/* ─── Main Editor Canvas Column ─── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header / Breadcrumbs Bar */}
        {!distractionFree && (
          <div className="px-6 py-2 border-b border-[#e0e0e0] flex items-center justify-between text-xs font-mono select-none bg-white">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-[#5f6368] truncate">
              <span className="text-[#5f6368]">WORKSPACE</span>
              <ChevronRight className="h-3 w-3" />
              {document.folder && (
                <>
                  <span className="text-[#3c4043] truncate">{document.folder.name}</span>
                  <ChevronRight className="h-3 w-3" />
                </>
              )}
              <span className="text-[#202124] truncate font-medium">{title}</span>
            </div>

            {/* Quick Canvas Controls */}
            <div className="flex items-center gap-1 text-[#5f6368]">
              <button
                type="button"
                onClick={handleToggleFavorite}
                className={`p-1.5 rounded transition-colors ${
                  isFavorite ? 'text-[#fbbc04]' : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
                }`}
                title={isFavorite ? 'Favorited' : 'Add to Favorites'}
              >
                <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleTogglePin}
                className={`p-1.5 rounded transition-colors ${
                  isPinned ? 'text-[#1a73e8]' : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
                }`}
                title={isPinned ? 'Pinned' : 'Pin Document'}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsTocOpen(!isTocOpen)}
                className={`p-1.5 rounded transition-colors ${
                  isTocOpen ? 'text-[#1a73e8] bg-[#e8f0fe]' : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
                }`}
                title="Table of Contents Outline"
              >
                <ListTree className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsFindReplaceOpen(!isFindReplaceOpen)}
                className={`p-1.5 rounded transition-colors ${
                  isFindReplaceOpen ? 'text-[#1a73e8] bg-[#e8f0fe]' : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]'
                }`}
                title="Find & Replace (⌘F)"
              >
                <Search className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsQuickCaptureOpen(true)}
                className="p-1.5 rounded text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
                title="Universal Quick Capture (Ctrl+Shift+C)"
              >
                <Zap className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a73e8] hover:bg-[#1558b0] text-white text-xs font-medium transition-colors"
                title="Share & Permissions"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="p-1.5 rounded text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
                title="Export Document"
              >
                <Download className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsRevisionModalOpen(true)}
                className="p-1.5 rounded text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
                title="Revision History"
              >
                <History className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors ${
                  isAiPanelOpen
                    ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#c5cff8] font-semibold'
                    : 'bg-white border-[#dadce0] text-[#3c4043] hover:bg-[#f1f3f4]'
                }`}
                title="AI Co-Pilot"
              >
                <Sparkles className="h-3 w-3" />
                <span>AI</span>
              </button>

              <button
                type="button"
                onClick={() => setDistractionFree(true)}
                className="p-1.5 rounded text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
                title="Distraction-Free Mode"
              >
                <Maximize className="h-3.5 w-3.5" />
              </button>

              {/* Actions Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                  className="p-1.5 rounded text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>

                {showActionsDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded bg-white border border-[#e0e0e0] shadow-xl p-1 z-40 text-xs space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        performSave();
                        setShowActionsDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#f1f3f4] rounded text-[#202124] flex items-center gap-2"
                    >
                      <Save className="h-3.5 w-3.5 text-[#5f6368]" />
                      <span>Save now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActivityModalOpen(true);
                        setShowActionsDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#f1f3f4] rounded text-[#3c4043] flex items-center gap-2"
                    >
                      <Activity className="h-3.5 w-3.5 text-[#5f6368]" />
                      <span>Version history</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDuplicate();
                        setShowActionsDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#f1f3f4] rounded text-[#3c4043] flex items-center gap-2"
                    >
                      <Copy className="h-3.5 w-3.5 text-[#5f6368]" />
                      <span>Make a copy</span>
                    </button>
                    <hr className="border-[#e0e0e0] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        handleTrashDocument();
                        setShowActionsDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#fce8e6] rounded text-[#ea4335] flex items-center gap-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Move to trash</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Distraction free exit bar */}
        {distractionFree && (
          <div className="p-2 border-b border-[#1C1C1C] flex justify-end">
            <button
              type="button"
              onClick={() => setDistractionFree(false)}
              className="px-2.5 py-1 rounded-[2px] bg-[#151515] hover:bg-[#222222] text-[#FAFAFA] border border-[#2D2D2D] font-mono text-xs flex items-center gap-1.5"
            >
              <Minimize className="h-3 w-3" />
              <span>EXIT FULLSCREEN</span>
            </button>
          </div>
        )}

        {/* TipTap Rich Formatting Toolbar */}
        {!distractionFree && (
          <EditorToolbar
            editor={editor}
            saveStatus={saveStatus}
            isFullWidth={isFullWidth}
            onToggleFullWidth={handleToggleFullWidth}
            onInsertImage={() => fileInputRef.current?.click()}
          />
        )}

        {/* Hidden image file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        {/* ─── Document Editing Canvas (Google Docs style paper) ─── */}
        <div className="flex-1 py-8 px-4">
          <div
            className={`mx-auto bg-white shadow-md transition-all ${
              isFullWidth ? 'max-w-5xl' : 'max-w-3xl'
            }`}
            style={{ minHeight: 'calc(100vh - 160px)', padding: '72px 96px' }}
          >
          {/* Document Icon & Title Header */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              {/* Icon Picker Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="text-3xl p-1 rounded hover:bg-[#f1f3f4] transition-colors"
                  title="Change Document Icon"
                >
                  {icon}
                </button>

                {showIconPicker && (
                  <div className="absolute left-0 top-full mt-1 p-2 rounded bg-white border border-[#e0e0e0] shadow-xl z-40 grid grid-cols-5 gap-1.5">
                    {iconsList.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => { setIcon(ic); setShowIconPicker(false); performSave(); }}
                        className="text-xl p-1.5 rounded hover:bg-[#f1f3f4]"
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Document Title Input - Google Docs style */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled"
              className="w-full bg-transparent text-[32px] font-normal text-[#202124] placeholder-[#bdc1c6] tracking-tight focus:outline-none pb-2 transition-colors"
              style={{ fontFamily: "'Google Sans', Arial, sans-serif", lineHeight: 1.3 }}
            />
          </div>

          {/* TipTap Editor Render Area */}
          <div className="relative prose-gdocs">
            <EditorContent editor={editor} />
          </div>

          {/* Footer Stats */}
          <div className="mt-16 pt-4 border-t border-[#e0e0e0] flex items-center justify-between text-[11px] text-[#9aa0a6]" style={{ fontFamily: 'monospace' }}>
            <div className="flex items-center gap-4">
              <span>{wordCount} words</span>
              <span>{charCount} characters</span>
            </div>
            <span>Version {version}</span>
          </div>
        </div>
      </div>
    </div>

      {/* ─── AI Side Panel Column ─── */}
      <AiAssistantPanel
        isOpen={isAiPanelOpen}
        onClose={() => setIsAiPanelOpen(false)}
        editor={editor}
        documentId={document.id}
      />

      {/* ─── Modals ─── */}
      <RevisionModal
        isOpen={isRevisionModalOpen}
        onClose={() => setIsRevisionModalOpen(false)}
        documentId={document.id}
        onRestored={onRefreshDocument}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        documentId={document.id}
        documentTitle={title}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        documentId={document.id}
        documentTitle={title}
      />

      <FindReplace
        editor={editor}
        isOpen={isFindReplaceOpen}
        onClose={() => setIsFindReplaceOpen(false)}
      />

      <TableOfContents
        editor={editor}
        isOpen={isTocOpen}
        onClose={() => setIsTocOpen(false)}
      />

      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        documentId={document.id}
      />

      <SlashCommandMenu
        editor={editor}
        isOpen={isSlashMenuOpen}
        onClose={() => setIsSlashMenuOpen(false)}
        onOpenAi={() => setIsAiPanelOpen(true)}
        onUploadImage={() => fileInputRef.current?.click()}
      />

      <UniversalQuickCapture
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onSuccess={onRefreshDocument}
      />
    </div>
  );
}
