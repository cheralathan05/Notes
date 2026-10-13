'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Grid,
  List,
  Folder as FolderIcon,
  Star,
  Trash2,
  Upload,
  Download,
  LayoutTemplate,
  MoreVertical,
  CheckSquare,
  Square,
  Clock,
  Pin,
  Zap,
} from 'lucide-react';
import { api, DocumentItem, FolderItem } from '@/lib/api';
import { CommandPalette } from '@/components/documents/command-palette';
import { TemplateModal } from '@/components/documents/template-modal';
import { UniversalQuickCapture } from '@/components/documents/universal-quick-capture';
import { PriorityIntelligenceHub } from '@/components/documents/priority-intelligence-hub';

function DocumentLibraryPageContent() {
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortField, setSortField] = useState<'updatedAt' | 'title' | 'createdAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);

  const fileImportRef = React.useRef<HTMLInputElement>(null);

  // Keyboard-first shortcuts (Ctrl+Shift+C -> Quick Capture, Ctrl+K -> Command Palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setIsQuickCaptureOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const [docsRes, foldersRes] = await Promise.all([
        api.listDocuments({
          search: search || undefined,
          folderId: selectedFolder !== 'all' ? selectedFolder : undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          sort: sortField,
          order: sortOrder,
        }),
        api.listFolders(),
      ]);

      if (docsRes.success && docsRes.data?.documents) {
        setDocuments(docsRes.data.documents);
      }
      if (foldersRes.success && foldersRes.data?.folders) {
        setFolders(foldersRes.data.folders);
      }
    } catch (e) {
      console.error('Failed to load documents', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedFolder, selectedStatus, sortField, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDocuments();
  };

  const handleCreateDocument = async (folderId?: string) => {
    const res = await api.createDocument({
      title: 'Untitled',
      folderId: folderId && folderId !== 'all' ? folderId : null,
    });
    if (res.success && res.data?.document) {
      router.push(`/documents/${res.data.document.id}`);
    }
  };

  const handleBulkAction = async (action: 'trash' | 'archive' | 'favorite') => {
    if (selectedIds.length === 0) return;
    await api.bulkDocuments({
      action,
      documentIds: selectedIds,
    });
    setSelectedIds([]);
    setIsBulkMode(false);
    loadDocuments();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        const title = file.name.replace(/\.[^/.]+$/, '');
        const res = await api.importDocument({
          title,
          contentText: text,
          format: file.name.endsWith('.md') ? 'markdown' : 'plain',
        });
        if (res.success && res.data?.document) {
          router.push(`/documents/${res.data.document.id}`);
        }
      }
    };
    reader.readAsText(file);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === documents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(documents.map((d) => d.id));
    }
  };

  return (
    <AppShell
      headerTitle="DOCUMENTS & NOTES"
      headerSubtitle="Sovereign knowledge graphs, structured blocks, and cryptographic persistence"
    >
      <div className="space-y-6 animate-fade-in select-none">
        {/* ─── Top Control Action Bar ─── */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D]">
          {/* Left: Search input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#737373]" />
              <input
                type="text"
                placeholder="Filter documents by title, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#151515] border border-[#2D2D2D] rounded-[2px] text-xs text-[#FAFAFA] placeholder-[#505050] focus:outline-none focus:border-[#FAFAFA]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-[2px] bg-[#1A1A1A] hover:bg-[#252525] border border-[#2D2D2D] font-mono text-xs text-[#FAFAFA]"
            >
              SEARCH
            </button>
          </form>

          {/* Right: Primary Creation Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQuickCaptureOpen(true)}
              className="px-3 py-1.5 rounded-[2px] bg-[#181818] hover:bg-[#222222] text-[#FAFAFA] border border-[#333333] font-mono text-xs flex items-center gap-1.5 transition-colors"
              title="Shortcut: Ctrl+Shift+C"
            >
              <Zap className="h-3.5 w-3.5 text-[#FAFAFA]" />
              <span>QUICK CAPTURE</span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateDocument(selectedFolder)}
              className="px-3.5 py-1.5 rounded-[2px] bg-[#FAFAFA] text-[#111111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>NEW DOCUMENT</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="px-3 py-1.5 rounded-[2px] bg-[#151515] hover:bg-[#1D1D1D] text-[#FAFAFA] border border-[#2D2D2D] font-mono text-xs flex items-center gap-1.5"
            >
              <LayoutTemplate className="h-3.5 w-3.5 text-[#737373]" />
              <span>TEMPLATES</span>
            </button>

            <button
              type="button"
              onClick={() => fileImportRef.current?.click()}
              className="px-3 py-1.5 rounded-[2px] bg-[#151515] hover:bg-[#1D1D1D] text-[#FAFAFA] border border-[#2D2D2D] font-mono text-xs flex items-center gap-1.5"
              title="Import Markdown or Text file"
            >
              <Upload className="h-3.5 w-3.5 text-[#737373]" />
              <span>IMPORT</span>
            </button>
            <input
              ref={fileImportRef}
              type="file"
              accept=".md,.txt,.markdown"
              className="hidden"
              onChange={handleFileImport}
            />
          </div>
        </div>

        {/* ─── Priority 1 Sovereign Intelligence Checklist & Daily Brief Hub ─── */}
        <PriorityIntelligenceHub
          documents={documents}
          onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
          onOpenTemplates={() => setIsTemplateModalOpen(true)}
          onOpenCommandPalette={() => setIsSearchOpen(true)}
          onNewDocument={() => handleCreateDocument(selectedFolder)}
          onTriggerImport={() => fileImportRef.current?.click()}
        />

        {/* ─── Filters & View Modes Toolbar ─── */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2">
            {/* Folder filter */}
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="bg-[#101010] border border-[#2D2D2D] text-[#FAFAFA] rounded-[2px] px-2.5 py-1.5 focus:outline-none"
            >
              <option value="all">ALL FOLDERS</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#101010] border border-[#2D2D2D] text-[#FAFAFA] rounded-[2px] px-2.5 py-1.5 focus:outline-none"
            >
              <option value="all">ALL STATUSES</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>

            {/* Sort field */}
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="bg-[#101010] border border-[#2D2D2D] text-[#FAFAFA] rounded-[2px] px-2.5 py-1.5 focus:outline-none"
            >
              <option value="updatedAt">SORT: RECENT MODIFICATION</option>
              <option value="title">SORT: TITLE</option>
              <option value="createdAt">SORT: DATE CREATED</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk mode toggle */}
            <button
              type="button"
              onClick={() => {
                setIsBulkMode(!isBulkMode);
                setSelectedIds([]);
              }}
              className={`px-2.5 py-1.5 rounded-[2px] border ${
                isBulkMode ? 'bg-[#222222] border-[#555555] text-[#FAFAFA]' : 'border-[#2D2D2D] text-[#737373]'
              }`}
            >
              {isBulkMode ? 'EXIT SELECTION' : 'SELECT'}
            </button>

            {/* Grid / List toggle */}
            <div className="flex border border-[#2D2D2D] rounded-[2px] overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 ${viewMode === 'grid' ? 'bg-[#1D1D1D] text-[#FAFAFA]' : 'text-[#737373]'}`}
              >
                <Grid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${viewMode === 'list' ? 'bg-[#1D1D1D] text-[#FAFAFA]' : 'text-[#737373]'}`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Bulk Action Banner (when items selected) ─── */}
        {isBulkMode && (
          <div className="p-3 bg-[#151515] border border-[#2D2D2D] rounded-[2px] flex items-center justify-between font-mono text-xs animate-slide-down">
            <div className="flex items-center gap-3">
              <button type="button" onClick={selectAll} className="flex items-center gap-1.5 text-[#FAFAFA]">
                {selectedIds.length === documents.length ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4 text-[#737373]" />
                )}
                <span>SELECT ALL ({selectedIds.length}/{documents.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => handleBulkAction('favorite')}
                className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#2D2D2D] text-[#FAFAFA] rounded-[2px] disabled:opacity-30"
              >
                FAVORITE
              </button>
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => handleBulkAction('archive')}
                className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#2D2D2D] text-[#FAFAFA] rounded-[2px] disabled:opacity-30"
              >
                ARCHIVE
              </button>
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => handleBulkAction('trash')}
                className="px-2.5 py-1 bg-[#1A1A1A] hover:bg-[#252525] border border-[#2D2D2D] text-[#FAFAFA] rounded-[2px] disabled:opacity-30"
              >
                MOVE TO TRASH
              </button>
            </div>
          </div>
        )}

        {/* ─── Document Collections ─── */}
        {loading ? (
          <div className="py-24 text-center font-mono text-xs text-[#737373] animate-pulse">
            LOADING DOCUMENT GRAPH...
          </div>
        ) : documents.length === 0 ? (
          <div className="py-24 text-center space-y-4 rounded-[var(--radius-sm)] bg-[#101010] border border-[#222222] p-8">
            <FileText className="h-10 w-10 text-[#505050] mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#FAFAFA] font-mono uppercase">
                NO DOCUMENTS IN CURRENT SCOPE
              </h3>
              <p className="text-xs text-[#737373]">
                Create your first sovereign note or instantiate one of the verified enterprise templates.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleCreateDocument(selectedFolder)}
                className="px-4 py-2 bg-[#FAFAFA] text-[#111111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold rounded-[2px]"
              >
                CREATE DOCUMENT
              </button>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                className="px-4 py-2 bg-[#151515] hover:bg-[#1D1D1D] text-[#FAFAFA] border border-[#2D2D2D] font-mono text-xs rounded-[2px]"
              >
                BROWSE TEMPLATES
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {documents.map((doc) => {
              const isSelected = selectedIds.includes(doc.id);

              return (
                <div
                  key={doc.id}
                  className={`rounded-[var(--radius-sm)] bg-[#121212] border transition-all p-4 flex flex-col justify-between group relative ${
                    isSelected ? 'border-[#FAFAFA] bg-[#181818]' : 'border-[#222222] hover:border-[#404040]'
                  }`}
                >
                  {/* Select box for bulk actions */}
                  {isBulkMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelect(doc.id)}
                      className="absolute top-3 right-3 text-[#FAFAFA] z-10"
                    >
                      {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-[#737373]" />}
                    </button>
                  )}

                  <Link href={`/documents/${doc.id}`} className="space-y-3 block">
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{doc.icon || '📄'}</span>
                      <div className="flex items-center gap-1 font-mono text-[9px]">
                        {doc.isPinned && <Pin className="h-3 w-3 text-[#FAFAFA]" />}
                        {doc.isFavorite && <Star className="h-3 w-3 text-[#FAFAFA] fill-current" />}
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#181818] border border-[#282828] text-[#737373]">
                          {doc.status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-[#FAFAFA] tracking-tight truncate group-hover:underline">
                        {doc.title}
                      </h4>
                      <p className="text-[11px] text-[#737373] mt-1 font-mono">
                        {doc.folder ? `📁 ${doc.folder.name}` : 'ROOT DIRECTORY'}
                      </p>
                    </div>
                  </Link>

                  <div className="pt-3 border-t border-[#1C1C1C] mt-3 flex items-center justify-between font-mono text-[10px] text-[#505050]">
                    <span>v{doc.version}</span>
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="rounded-[var(--radius-sm)] bg-[#101010] border border-[#222222] divide-y divide-[#1C1C1C] overflow-hidden">
            {documents.map((doc) => {
              const isSelected = selectedIds.includes(doc.id);

              return (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between p-3 transition-colors ${
                    isSelected ? 'bg-[#181818]' : 'hover:bg-[#141414]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isBulkMode && (
                      <button type="button" onClick={() => toggleSelect(doc.id)}>
                        {isSelected ? <CheckSquare className="h-4 w-4 text-[#FAFAFA]" /> : <Square className="h-4 w-4 text-[#737373]" />}
                      </button>
                    )}

                    <span className="text-base flex-shrink-0">{doc.icon || '📄'}</span>

                    <Link href={`/documents/${doc.id}`} className="min-w-0 flex-1 truncate">
                      <span className="text-xs font-medium text-[#FAFAFA] truncate hover:underline">
                        {doc.title}
                      </span>
                    </Link>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-xs text-[#737373] flex-shrink-0">
                    {doc.folder && (
                      <span className="hidden sm:inline text-[11px] px-1.5 py-0.5 rounded-[2px] bg-[#151515] border border-[#222222]">
                        {doc.folder.name}
                      </span>
                    )}
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-[2px] bg-[#181818] border border-[#262626]">
                      {doc.status}
                    </span>
                    <span className="text-[11px] text-[#505050]">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNewDocument={handleCreateDocument}
      />

      {/* Global Template Modal */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />

      {/* Universal Quick Capture (Ctrl+Shift+C) */}
      <UniversalQuickCapture
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onSuccess={loadDocuments}
      />
    </AppShell>
  );
}

export default function DocumentLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#080808] flex items-center justify-center font-mono text-xs text-[#737373] animate-pulse">
          INITIALIZING DOCUMENT LIBRARY...
        </div>
      }
    >
      <DocumentLibraryPageContent />
    </Suspense>
  );
}
