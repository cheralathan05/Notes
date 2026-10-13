'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Folder, Plus, ArrowRight, X, Clock } from 'lucide-react';
import { api, SearchResultItem } from '@/lib/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewDocument: () => void;
}

export function CommandPalette({ isOpen, onClose, onNewDocument }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [recentDocs, setRecentDocs] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      api.getRecentDocuments().then((res) => {
        if (res.success && res.data?.documents) {
          setRecentDocs(res.data.documents);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await api.searchWorkspace(query.trim());
      if (res.success && res.data?.results) {
        setResults(res.data.results);
      }
      setLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const items = query.trim() ? results : recentDocs;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          router.push(`/documents/${items[selectedIndex].id}`);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, router, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] shadow-2xl overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#222222] gap-3">
          <Search className="h-4 w-4 text-[#737373] flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, plain text, or jump to..."
            className="flex-1 bg-transparent text-[#FAFAFA] placeholder-[#505050] text-sm focus:outline-none"
          />
          {loading && (
            <span className="font-mono text-[10px] text-[#737373] uppercase tracking-wider animate-pulse">
              SEARCHING...
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-[#737373] hover:text-[#FAFAFA] p-0.5"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Action: New Document */}
        <div className="px-3 py-2 border-b border-[#1C1C1C] bg-[#121212]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewDocument();
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#FAFAFA] hover:bg-[#1A1A1A] rounded-[2px] transition-colors font-mono"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5 text-[#FAFAFA]" />
              <span>CREATE NEW DOCUMENT</span>
            </div>
            <span className="text-[10px] text-[#737373]">PRESS ↵</span>
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#737373] font-mono">
              {query ? 'NO DOCUMENTS MATCH YOUR QUERY' : 'NO RECENT DOCUMENTS'}
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    router.push(`/documents/${item.id}`);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-[2px] flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-[#1D1D1D] text-[#FAFAFA]' : 'text-[#A3A3A3] hover:bg-[#151515]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm flex-shrink-0">{item.icon || '📄'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#FAFAFA] truncate">
                        {item.title}
                      </div>
                      {item.snippet && (
                        <div className="text-[11px] text-[#737373] truncate max-w-sm mt-0.5 font-mono">
                          {item.snippet}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10px] text-[#737373] flex-shrink-0 ml-2">
                    {item.folder && (
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-[#181818] border border-[#262626]">
                        {item.folder.name}
                      </span>
                    )}
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-[#1C1C1C] bg-[#0D0D0D] flex items-center justify-between font-mono text-[10px] text-[#505050]">
          <div className="flex items-center gap-3">
            <span>↑↓ NAVIGATE</span>
            <span>↵ OPEN</span>
            <span>ESC CLOSE</span>
          </div>
          <span>KRONOS TELEMETRY SEARCH</span>
        </div>
      </div>
    </div>
  );
}
