'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FileText,
  Folder as FolderIcon,
  ChevronRight,
  ChevronDown,
  Plus,
  Star,
  Trash2,
  LayoutTemplate,
  Search,
  MoreVertical,
  Layers,
  ChevronLeft,
  Archive,
  Pin,
  ExternalLink,
} from 'lucide-react';
import { api, DocumentItem, FolderItem } from '@/lib/api';

interface WorkspaceSidebarProps {
  currentDocumentId?: string;
  onOpenSearch: () => void;
  onOpenTemplates: () => void;
  onNewDocument: (folderId?: string) => void;
}

export function WorkspaceSidebar({
  currentDocumentId,
  onOpenSearch,
  onOpenTemplates,
  onNewDocument,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'trash'>('all');
  const [workspaceName, setWorkspaceName] = useState('Sovereign Workspace');

  const loadData = async () => {
    try {
      const [docsRes, foldersRes] = await Promise.all([
        api.listDocuments({ isTrash: activeTab === 'trash' }),
        api.listFolders(),
      ]);

      if (docsRes.success && docsRes.data?.documents) {
        setDocuments(docsRes.data.documents);
        if (docsRes.data.workspace?.name) {
          setWorkspaceName(docsRes.data.workspace.name);
        }
      }

      if (foldersRes.success && foldersRes.data?.folders) {
        setFolders(foldersRes.data.folders);
      }
    } catch (e) {
      console.error('Failed to load sidebar data', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const res = await api.createFolder({ name: newFolderName.trim() });
    if (res.success && res.data?.folder) {
      setFolders((prev) => [...prev, res.data!.folder]);
      setExpandedFolders((prev) => ({ ...prev, [res.data!.folder.id]: true }));
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const favorites = documents.filter((d) => d.isFavorite);
  const rootDocuments = documents.filter((d) => !d.folderId && !d.parentId);

  if (collapsed) {
    return (
      <aside className="w-12 h-screen bg-[#0D0D0D] border-r border-[#2D2D2D] flex flex-col items-center py-4 space-y-4 select-none">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="p-2 text-[#737373] hover:text-[#FAFAFA] hover:bg-[#151515] rounded-[2px]"
          title="Expand Sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onNewDocument()}
          className="p-2 bg-[#FAFAFA] text-[#111111] rounded-[2px] hover:bg-[#E5E5E5]"
          title="New Document"
        >
          <Plus className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="p-2 text-[#737373] hover:text-[#FAFAFA] hover:bg-[#151515] rounded-[2px]"
          title="Search (⌘K)"
        >
          <Search className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 h-screen bg-[#0D0D0D] border-r border-[#2D2D2D] flex flex-col select-none flex-shrink-0">
      {/* ─── Header & Workspace Title ─── */}
      <div className="p-3.5 border-b border-[#222222] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-[2px] bg-[#151515] border border-[#2D2D2D] flex items-center justify-center font-mono text-[10px] text-[#FAFAFA]">
            K
          </div>
          <span className="font-mono text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider truncate">
            {workspaceName}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-[#737373] hover:text-[#FAFAFA] p-1 rounded-[2px]"
          title="Collapse Sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* ─── Global Actions (New Doc, Search, Templates) ─── */}
      <div className="p-2 space-y-1 border-b border-[#222222]">
        <button
          type="button"
          onClick={() => onNewDocument()}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[2px] bg-[#151515] hover:bg-[#1D1D1D] text-[#FAFAFA] border border-[#2D2D2D] font-mono text-xs tracking-wide transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>NEW DOCUMENT</span>
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[2px] text-[#A3A3A3] hover:text-[#FAFAFA] hover:bg-[#151515] font-mono text-xs transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-[#737373]" />
            <span>SEARCH</span>
          </div>
          <span className="text-[10px] text-[#505050] border border-[#222222] px-1 rounded-[2px]">
            ⌘K
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenTemplates}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[2px] text-[#A3A3A3] hover:text-[#FAFAFA] hover:bg-[#151515] font-mono text-xs transition-colors"
        >
          <LayoutTemplate className="h-3.5 w-3.5 text-[#737373]" />
          <span>TEMPLATES CATALOG</span>
        </button>
      </div>

      {/* ─── Navigation Filters (All, Favorites, Trash) ─── */}
      <div className="flex border-b border-[#222222] px-2 py-1 gap-1 font-mono text-[11px]">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-1 text-center rounded-[2px] transition-colors ${
            activeTab === 'all'
              ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]'
              : 'text-[#737373] hover:text-[#FAFAFA]'
          }`}
        >
          ALL
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-1 text-center rounded-[2px] transition-colors ${
            activeTab === 'favorites'
              ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]'
              : 'text-[#737373] hover:text-[#FAFAFA]'
          }`}
        >
          FAVORITES ({favorites.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trash')}
          className={`flex-1 py-1 text-center rounded-[2px] transition-colors ${
            activeTab === 'trash'
              ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]'
              : 'text-[#737373] hover:text-[#FAFAFA]'
          }`}
        >
          TRASH
        </button>
      </div>

      {/* ─── Tree Navigation View ─── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {activeTab === 'trash' ? (
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono text-[#737373] uppercase">
              DELETED DOCUMENTS
            </div>
            {documents.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#505050] font-mono">
                TRASH IS EMPTY
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-[2px] hover:bg-[#151515] text-xs text-[#A3A3A3] group"
                >
                  <span className="truncate flex-1">{doc.title}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={async () => {
                        await api.restoreDocument(doc.id);
                        loadData();
                      }}
                      className="px-1.5 py-0.5 rounded-[2px] bg-[#1A1A1A] hover:bg-[#252525] text-[10px] text-[#FAFAFA] font-mono border border-[#333333]"
                    >
                      RESTORE
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.permanentDeleteDocument(doc.id);
                        loadData();
                      }}
                      className="p-1 hover:text-[#FAFAFA]"
                      title="Delete permanently"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'favorites' ? (
          <div className="space-y-0.5">
            {favorites.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#505050] font-mono">
                NO FAVORITED DOCUMENTS
              </div>
            ) : (
              favorites.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[2px] text-xs transition-colors ${
                    doc.id === currentDocumentId
                      ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]'
                      : 'text-[#A3A3A3] hover:text-[#FAFAFA] hover:bg-[#121212]'
                  }`}
                >
                  <span className="text-xs">{doc.icon || '📄'}</span>
                  <span className="truncate flex-1">{doc.title}</span>
                  <Star className="h-3 w-3 text-[#FAFAFA] fill-current" />
                </Link>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* ─── Folders Section ─── */}
            <div>
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono text-[#737373] uppercase tracking-wider">
                <span>FOLDERS</span>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(true)}
                  className="hover:text-[#FAFAFA] p-0.5"
                  title="New Folder"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {isCreatingFolder && (
                <form onSubmit={handleCreateFolder} className="px-2 py-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onBlur={() => !newFolderName.trim() && setIsCreatingFolder(false)}
                    className="w-full bg-[#151515] border border-[#2D2D2D] rounded-[2px] px-2 py-1 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#FAFAFA]"
                  />
                </form>
              )}

              <div className="space-y-0.5 mt-0.5">
                {folders.map((folder) => {
                  const isExpanded = !!expandedFolders[folder.id];
                  const folderDocs = documents.filter((d) => d.folderId === folder.id);

                  return (
                    <div key={folder.id} className="space-y-0.5">
                      <div className="flex items-center justify-between px-2 py-1 rounded-[2px] hover:bg-[#141414] text-xs text-[#A3A3A3] group">
                        <button
                          type="button"
                          onClick={() => toggleFolder(folder.id)}
                          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-[#737373]" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-[#737373]" />
                          )}
                          <FolderIcon className="h-3.5 w-3.5 text-[#737373] group-hover:text-[#FAFAFA]" />
                          <span className="truncate group-hover:text-[#FAFAFA]">{folder.name}</span>
                        </button>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => onNewDocument(folder.id)}
                            className="p-0.5 text-[#737373] hover:text-[#FAFAFA]"
                            title="Add document to folder"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pl-4 space-y-0.5 border-l border-[#1F1F1F] ml-3">
                          {folderDocs.length === 0 ? (
                            <div className="px-2 py-1 text-[11px] text-[#505050] italic">
                              Empty folder
                            </div>
                          ) : (
                            folderDocs.map((doc) => (
                              <Link
                                key={doc.id}
                                href={`/documents/${doc.id}`}
                                className={`flex items-center gap-2 px-2 py-1 rounded-[2px] text-xs transition-colors ${
                                  doc.id === currentDocumentId
                                    ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]'
                                    : 'text-[#888888] hover:text-[#FAFAFA] hover:bg-[#121212]'
                                }`}
                              >
                                <span className="text-[11px]">{doc.icon || '📄'}</span>
                                <span className="truncate flex-1">{doc.title}</span>
                              </Link>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Root Documents ─── */}
            <div>
              <div className="px-2 py-1 text-[10px] font-mono text-[#737373] uppercase tracking-wider">
                DOCUMENTS
              </div>

              <div className="space-y-0.5 mt-0.5">
                {rootDocuments.length === 0 ? (
                  <div className="px-2 py-1 text-[11px] text-[#505050] italic">
                    No root documents
                  </div>
                ) : (
                  rootDocuments.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[2px] text-xs transition-colors ${
                        doc.id === currentDocumentId
                          ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]'
                          : 'text-[#A3A3A3] hover:text-[#FAFAFA] hover:bg-[#121212]'
                      }`}
                    >
                      <span className="text-xs">{doc.icon || '📄'}</span>
                      <span className="truncate flex-1">{doc.title}</span>
                      {doc.isPinned && <Pin className="h-3 w-3 text-[#737373]" />}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Footer with Library Link ─── */}
      <div className="p-2 border-t border-[#222222] bg-[#0A0A0A]">
        <Link
          href="/documents"
          className="flex items-center justify-between px-2.5 py-1.5 rounded-[2px] text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414] font-mono text-[11px] transition-colors"
        >
          <span>VIEW DOCUMENT LIBRARY</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </aside>
  );
}
