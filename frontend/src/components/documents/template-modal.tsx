'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutTemplate,
  Search,
  X,
  ArrowRight,
  Check,
  Star,
  Eye,
  Copy,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  RefreshCw,
  FolderPlus,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { api, TemplateItem } from '@/lib/api';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId?: string;
  currentDocumentId?: string;
  onDocumentCreated?: (documentId: string) => void;
  onDocumentUpdated?: () => void;
}

export function TemplateModal({
  isOpen,
  onClose,
  folderId,
  currentDocumentId,
  onDocumentCreated,
  onDocumentUpdated,
}: TemplateModalProps) {
  const router = useRouter();

  // State
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'popular'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview & Instantiation Modal State
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  const [previewDetails, setPreviewDetails] = useState<TemplateItem | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState(false);

  // Custom Template Creation State
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customCategory, setCustomCategory] = useState('General');
  const [customIcon, setCustomIcon] = useState('📋');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);

  const categories = [
    'All',
    'Work',
    'Personal',
    'Engineering',
    'Product',
    'Research',
    'Education',
    'General',
  ];

  // Fetch templates when modal opens or filter changes
  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const filterParam = filterType === 'favorites' ? 'favorites' : filterType === 'popular' ? 'popular' : undefined;
      const res = await api.listTemplates(
        selectedCategory === 'All' ? undefined : selectedCategory,
        search.trim() || undefined,
        filterParam
      );
      if (res.success && res.data?.templates) {
        setTemplates(res.data.templates);
      } else {
        setError(res.error?.message || 'Failed to load templates catalog');
      }
    } catch {
      setError('Network communication failed. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, selectedCategory, filterType, search]);

  // Load template details when previewing
  useEffect(() => {
    if (previewTemplate) {
      setDocTitle(previewTemplate.name);
      setLoadingPreview(true);
      setReplaceConfirm(false);
      api.getTemplate(previewTemplate.id).then((res) => {
        if (res.success && res.data?.template) {
          setPreviewDetails(res.data.template);
        } else {
          setPreviewDetails(previewTemplate);
        }
        setLoadingPreview(false);
      });
    } else {
      setPreviewDetails(null);
    }
  }, [previewTemplate]);

  // Handle Create Document from Template
  const handleUseTemplate = async (template: TemplateItem) => {
    setIsApplying(true);
    try {
      const res = await api.useTemplate(template.id, {
        title: docTitle.trim() || template.name,
        folderId: folderId || null,
      });

      if (res.success && res.data?.document) {
        setPreviewTemplate(null);
        onClose();
        if (onDocumentCreated) {
          onDocumentCreated(res.data.document.id);
        } else {
          router.push(`/documents/${res.data.document.id}`);
        }
      } else {
        alert(res.error?.message || 'Failed to create document from template');
      }
    } catch {
      alert('Error creating document from template');
    } finally {
      setIsApplying(false);
    }
  };

  // Handle Apply to Current Document (Replace Policy)
  const handleApplyToCurrent = async (template: TemplateItem) => {
    if (!currentDocumentId) return;
    if (!replaceConfirm) {
      setReplaceConfirm(true);
      return;
    }

    setIsApplying(true);
    try {
      const res = await api.applyTemplateToDocument(template.id, currentDocumentId);
      if (res.success && res.data?.document) {
        setPreviewTemplate(null);
        onClose();
        if (onDocumentUpdated) {
          onDocumentUpdated();
        } else {
          router.refresh();
        }
      } else {
        alert(res.error?.message || 'Failed to apply template to current document');
      }
    } catch {
      alert('Error applying template');
    } finally {
      setIsApplying(false);
    }
  };

  // Handle Toggle Favorite
  const handleToggleFavorite = async (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    const res = await api.toggleFavoriteTemplate(templateId);
    if (res.success && res.data?.template) {
      const isFav = res.data.template.isFavorite;
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, isFavorite: isFav } : t))
      );
      if (previewDetails && previewDetails.id === templateId) {
        setPreviewDetails((prev) => prev ? { ...prev, isFavorite: isFav } : null);
      }
    }
  };

  // Handle Duplicate Template
  const handleDuplicate = async (templateId: string) => {
    const res = await api.duplicateTemplate(templateId);
    if (res.success && res.data?.template) {
      setPreviewTemplate(null);
      fetchTemplates();
    }
  };

  // Handle Delete Custom Template
  const handleDeleteCustom = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this custom template?')) return;
    const res = await api.deleteTemplate(templateId);
    if (res.success) {
      setPreviewTemplate(null);
      fetchTemplates();
    } else {
      alert(res.error?.message || 'Failed to delete template');
    }
  };

  // Handle Create Custom Template
  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    setIsCreatingCustom(true);
    try {
      const res = await api.saveAsTemplate({
        documentId: currentDocumentId || '', // if none, will be handled by custom creator
        name: customName.trim(),
        description: customDesc.trim(),
        category: customCategory,
      });
      if (res.success) {
        setShowCreateCustom(false);
        setCustomName('');
        setCustomDesc('');
        fetchTemplates();
      }
    } catch {
      alert('Failed to create custom template');
    } finally {
      setIsCreatingCustom(false);
    }
  };

  // Render node summary in preview
  const renderPreviewContent = (content: any) => {
    if (!content || !content.content || !Array.isArray(content.content)) {
      return <p className="text-xs text-[#737373] italic">Empty document canvas</p>;
    }

    return (
      <div className="space-y-2.5 text-xs">
        {content.content.map((node: any, idx: number) => {
          if (node.type === 'heading') {
            const level = node.attrs?.level || 1;
            const text = (node.content || []).map((c: any) => c.text || '').join('');
            if (level === 1) {
              return (
                <h2 key={idx} className="text-sm font-semibold text-[#FAFAFA] pt-2 border-b border-[#222222] pb-1">
                  {text}
                </h2>
              );
            }
            if (level === 2) {
              return (
                <h3 key={idx} className="text-xs font-semibold text-[#D4D4D4] pt-1">
                  {text}
                </h3>
              );
            }
            return (
              <h4 key={idx} className="text-xs font-medium text-[#A3A3A3]">
                {text}
              </h4>
            );
          }

          if (node.type === 'paragraph') {
            const text = (node.content || []).map((c: any) => c.text || '').join('');
            return (
              <p key={idx} className="text-[#888888] leading-relaxed">
                {text || <span className="text-[#555555] italic">[Empty paragraph]</span>}
              </p>
            );
          }

          if (node.type === 'taskList') {
            return (
              <div key={idx} className="space-y-1 pl-1">
                {(node.content || []).map((task: any, tIdx: number) => {
                  const tText = (task.content?.[0]?.content || []).map((c: any) => c.text || '').join('');
                  return (
                    <div key={tIdx} className="flex items-center gap-2 text-[#A3A3A3]">
                      <div className="w-3 h-3 rounded-[2px] border border-[#444444] flex items-center justify-center text-[9px]">
                        {task.attrs?.checked ? '✓' : ''}
                      </div>
                      <span>{tText}</span>
                    </div>
                  );
                })}
              </div>
            );
          }

          if (node.type === 'bulletList') {
            return (
              <ul key={idx} className="list-disc list-inside space-y-1 text-[#888888] pl-2">
                {(node.content || []).map((item: any, iIdx: number) => {
                  const iText = (item.content?.[0]?.content || []).map((c: any) => c.text || '').join('');
                  return <li key={iIdx}>{iText}</li>;
                })}
              </ul>
            );
          }

          if (node.type === 'blockquote') {
            const bText = (node.content?.[0]?.content || []).map((c: any) => c.text || '').join('');
            return (
              <blockquote key={idx} className="border-l-2 border-[#555555] pl-3 py-0.5 text-[#B0B0B0] italic bg-[#151515]">
                {bText}
              </blockquote>
            );
          }

          if (node.type === 'codeBlock') {
            const cText = (node.content || []).map((c: any) => c.text || '').join('');
            return (
              <pre key={idx} className="bg-[#0C0C0C] border border-[#222222] p-2 rounded-[2px] font-mono text-[11px] text-[#A3A3A3] overflow-x-auto">
                <code>{cText}</code>
              </pre>
            );
          }

          if (node.type === 'table') {
            return (
              <div key={idx} className="border border-[#2D2D2D] rounded-[2px] p-2 bg-[#121212] text-[11px] text-[#737373]">
                [Structured Table Matrix]
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div
        className="w-full max-w-5xl h-[700px] max-h-[92vh] rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-catalog-title"
      >
        {/* ─── Header ─── */}
        <div className="p-4 border-b border-[#222222] flex items-center justify-between bg-[#111111]">
          <div className="flex items-center gap-2.5">
            <LayoutTemplate className="h-4 w-4 text-[#FAFAFA]" />
            <div>
              <h2 id="template-catalog-title" className="font-mono text-sm font-semibold text-[#FAFAFA] tracking-wider uppercase">
                WORKSPACE TEMPLATES CATALOG
              </h2>
              <p className="text-[11px] text-[#737373] font-mono">
                Sovereign blueprints for engineering, planning, research & operations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-[#737373] hover:text-[#FAFAFA] p-1.5 rounded-[2px] hover:bg-[#1D1D1D] transition-colors"
              title="Close (Escape)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ─── Filters & Search Strip ─── */}
        <div className="p-3 border-b border-[#1E1E1E] bg-[#141414] flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none font-mono text-xs max-w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-[2px] transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#FAFAFA] text-[#111111] font-semibold'
                    : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#1D1D1D]'
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Quick Filters & Search */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Filter buttons */}
            <div className="flex items-center border border-[#2D2D2D] rounded-[2px] overflow-hidden bg-[#101010]">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2 py-1 text-[11px] font-mono transition-colors ${
                  filterType === 'all' ? 'bg-[#222222] text-[#FAFAFA]' : 'text-[#737373] hover:text-[#FAFAFA]'
                }`}
                title="All catalog blueprints"
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => setFilterType('favorites')}
                className={`px-2 py-1 text-[11px] font-mono flex items-center gap-1 transition-colors ${
                  filterType === 'favorites' ? 'bg-[#222222] text-[#FAFAFA]' : 'text-[#737373] hover:text-[#FAFAFA]'
                }`}
                title="Starred favorites"
              >
                <Star className="h-3 w-3 fill-current" />
                <span>STARRED</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('popular')}
                className={`px-2 py-1 text-[11px] font-mono transition-colors ${
                  filterType === 'popular' ? 'bg-[#222222] text-[#FAFAFA]' : 'text-[#737373] hover:text-[#FAFAFA]'
                }`}
                title="Most frequently used"
              >
                POPULAR
              </button>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#737373]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search blueprints..."
                className="w-full bg-[#101010] border border-[#2D2D2D] rounded-[2px] pl-8 pr-7 py-1 text-xs text-[#FAFAFA] placeholder-[#555555] focus:outline-none focus:border-[#555555]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#FAFAFA]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Main Gallery Grid Area ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#0C0C0C]">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-36 rounded-[2px] bg-[#141414] border border-[#222222] animate-pulse p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded bg-[#1F1F1F]" />
                    <div className="w-16 h-4 rounded bg-[#1F1F1F]" />
                  </div>
                  <div className="w-3/4 h-4 rounded bg-[#1F1F1F]" />
                  <div className="w-full h-8 rounded bg-[#1F1F1F]" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <AlertCircle className="h-8 w-8 text-[#E53E3E]" />
              <div className="text-sm font-semibold text-[#FAFAFA]">{error}</div>
              <button
                type="button"
                onClick={fetchTemplates}
                className="px-3 py-1.5 rounded-[2px] bg-[#181818] border border-[#333333] hover:bg-[#222222] text-xs font-mono text-[#FAFAFA] flex items-center gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : templates.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
              <LayoutTemplate className="h-10 w-10 text-[#444444]" />
              <div className="text-sm font-semibold text-[#FAFAFA]">No blueprints matched your query</div>
              <p className="text-xs text-[#737373] max-w-md">
                Try searching for different keywords or reset your category filters to view the complete catalog.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('All');
                  setFilterType('all');
                }}
                className="mt-2 px-3 py-1 bg-[#181818] border border-[#2E2E2E] hover:bg-[#222222] text-xs font-mono text-[#FAFAFA] rounded-[2px]"
              >
                RESET FILTERS
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setPreviewTemplate(tpl)}
                  className="group relative rounded-[2px] bg-[#121212] hover:bg-[#161616] border border-[#222222] hover:border-[#383838] transition-all p-4 flex flex-col justify-between cursor-pointer space-y-3 shadow-sm hover:shadow-lg"
                >
                  {/* Top Bar: Icon, Category Badge, Favorite Star */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="w-8 h-8 rounded-[2px] bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-base">
                        {tpl.icon || '📄'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-[2px] bg-[#181818] border border-[#262626] text-[#A3A3A3] uppercase">
                          {tpl.category}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, tpl.id)}
                          className={`p-1 rounded-[2px] transition-colors ${
                            tpl.isFavorite
                              ? 'text-[#FAFAFA] hover:text-[#D4D4D4]'
                              : 'text-[#444444] hover:text-[#FAFAFA]'
                          }`}
                          title={tpl.isFavorite ? 'Remove star' : 'Star blueprint'}
                        >
                          <Star className={`h-3.5 w-3.5 ${tpl.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Template Title */}
                    <h3 className="text-sm font-semibold text-[#FAFAFA] tracking-tight group-hover:text-white transition-colors">
                      {tpl.name}
                    </h3>

                    {/* Template Short Description */}
                    <p className="text-xs text-[#737373] line-clamp-2 mt-1 leading-relaxed">
                      {tpl.description || 'Structured blueprint for fast execution.'}
                    </p>
                  </div>

                  {/* Bottom Action Strip */}
                  <div className="pt-2 border-t border-[#1C1C1C] flex items-center justify-between text-[11px] font-mono text-[#555555]">
                    <span className="flex items-center gap-1 text-[#666666]">
                      <Eye className="h-3 w-3" />
                      <span>PREVIEW</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseTemplate(tpl);
                      }}
                      className="px-2.5 py-1 bg-[#1A1A1A] group-hover:bg-[#FAFAFA] text-[#A3A3A3] group-hover:text-[#111111] group-hover:font-semibold rounded-[2px] border border-[#2C2C2C] group-hover:border-transparent transition-all flex items-center gap-1"
                    >
                      <span>USE</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Footer Status ─── */}
        <div className="p-3 border-t border-[#1E1E1E] bg-[#111111] flex items-center justify-between font-mono text-[11px] text-[#555555]">
          <div className="flex items-center gap-3">
            <span>CATALOG: {templates.length} BLUEPRINTS</span>
            <span>CATEGORY: {selectedCategory.toUpperCase()}</span>
          </div>
          <span>KRONOS BLUEPRINT MATRIX // VERIFIED</span>
        </div>
      </div>

      {/* ─── Template Detail Preview Dialog ─── */}
      {previewTemplate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-[var(--radius-sm)] bg-[#121212] border border-[#333333] shadow-2xl flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#222222] flex items-center justify-between bg-[#161616]">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{previewTemplate.icon || '📄'}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[#FAFAFA] tracking-tight">
                      {previewTemplate.name}
                    </h3>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-[2px] bg-[#222222] border border-[#333333] text-[#A3A3A3] uppercase">
                      {previewTemplate.category}
                    </span>
                    {previewTemplate.isSystem && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-[2px] bg-[#1A1A1A] text-[#737373]">
                        SYSTEM
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#737373] mt-0.5">
                    {previewTemplate.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="text-[#737373] hover:text-[#FAFAFA] p-1.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Blueprint Sections Body Preview */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#0D0D0D] space-y-4">
              <div className="text-[11px] font-mono text-[#555555] uppercase tracking-wider flex items-center justify-between pb-1 border-b border-[#1E1E1E]">
                <span>BLUEPRINT STRUCTURE & SECTIONS</span>
                {loadingPreview && <span>SYNCING SPEC...</span>}
              </div>

              {loadingPreview ? (
                <div className="space-y-2 py-8 text-center text-xs text-[#737373]">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto text-[#888888]" />
                  <span>Loading blueprint nodes...</span>
                </div>
              ) : (
                <div className="p-4 rounded-[2px] bg-[#141414] border border-[#222222]">
                  {renderPreviewContent(previewDetails?.content)}
                </div>
              )}

              {/* Title & Configuration Form */}
              <div className="pt-2 border-t border-[#1F1F1F] space-y-2">
                <label className="block text-[11px] font-mono text-[#737373] uppercase">
                  DOCUMENT TITLE TO CREATE
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Enter document title..."
                  className="w-full bg-[#161616] border border-[#2B2B2B] rounded-[2px] px-3 py-1.5 text-xs text-[#FAFAFA] font-medium focus:outline-none focus:border-[#555555]"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-[#222222] bg-[#151515] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDuplicate(previewTemplate.id)}
                  className="px-2.5 py-1.5 rounded-[2px] bg-[#1E1E1E] hover:bg-[#282828] text-[#FAFAFA] text-xs font-mono border border-[#333333] flex items-center gap-1.5 transition-colors"
                  title="Duplicate as editable custom template"
                >
                  <Copy className="h-3 w-3" />
                  <span>DUPLICATE</span>
                </button>

                {!previewTemplate.isSystem && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustom(previewTemplate.id)}
                    className="p-1.5 rounded-[2px] text-[#E53E3E] hover:bg-[#2A1515] transition-colors"
                    title="Delete custom template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentDocumentId && (
                  <button
                    type="button"
                    onClick={() => handleApplyToCurrent(previewTemplate)}
                    disabled={isApplying}
                    className={`px-3 py-1.5 rounded-[2px] text-xs font-mono transition-colors border ${
                      replaceConfirm
                        ? 'bg-[#E53E3E] text-white border-transparent'
                        : 'bg-[#1E1E1E] hover:bg-[#252525] text-[#FAFAFA] border-[#383838]'
                    }`}
                  >
                    {replaceConfirm ? 'CONFIRM OVERWRITE' : 'APPLY TO CURRENT'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleUseTemplate(previewTemplate)}
                  disabled={isApplying}
                  className="px-4 py-1.5 rounded-[2px] bg-[#FAFAFA] hover:bg-[#EAEAEA] text-[#111111] font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isApplying ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>INITIALIZING...</span>
                    </>
                  ) : (
                    <>
                      <span>USE TEMPLATE</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
