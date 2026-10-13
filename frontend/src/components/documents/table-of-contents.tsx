'use client';

import React, { useState, useEffect } from 'react';
import { type Editor } from '@tiptap/react';
import { ListTree, X, ChevronRight, Hash } from 'lucide-react';

interface TableOfContentsProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ editor, isOpen, onClose }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocItem[]>([]);

  useEffect(() => {
    if (!editor) return;

    const extractHeadings = () => {
      const items: TocItem[] = [];
      const json = editor.getJSON();

      function walk(node: any) {
        if (!node) return;
        if (node.type === 'heading' && node.content) {
          const text = node.content.map((c: any) => c.text).join('');
          if (text) {
            items.push({
              id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              text,
              level: node.attrs?.level || 1,
            });
          }
        }
        if (Array.isArray(node.content)) {
          node.content.forEach(walk);
        }
      }

      walk(json);
      setHeadings(items);
    };

    extractHeadings();
    editor.on('update', extractHeadings);
    return () => {
      editor.off('update', extractHeadings);
    };
  }, [editor]);

  if (!isOpen) return null;

  const scrollToHeading = (text: string) => {
    if (!editor) return;
    const elements = window.document.querySelectorAll('h1, h2, h3');
    for (const el of Array.from(elements)) {
      if (el.textContent?.trim().toLowerCase() === text.trim().toLowerCase()) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  };

  return (
    <div className="absolute top-12 right-20 z-40 bg-[#121212] border border-[#2D2D2D] rounded-[var(--radius-sm)] shadow-2xl p-4 w-72 font-mono text-xs space-y-3 animate-slide-down select-none">
      <div className="flex items-center justify-between border-b border-[#222222] pb-2 text-[#FAFAFA]">
        <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider">
          <ListTree className="h-3.5 w-3.5 text-[#FAFAFA]" />
          <span>OUTLINE / TOC ({headings.length})</span>
        </div>
        <button type="button" onClick={onClose} className="text-[#737373] hover:text-[#FAFAFA]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto space-y-1">
        {headings.length === 0 ? (
          <div className="py-6 text-center text-[#505050] text-[11px] italic">
            No headings found. Add H1, H2, or H3 headings to populate this table of contents.
          </div>
        ) : (
          headings.map((h, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToHeading(h.text)}
              className={`w-full text-left py-1 px-1.5 rounded-[2px] hover:bg-[#1A1A1A] hover:text-[#FAFAFA] transition-colors truncate flex items-center gap-1.5 ${
                h.level === 1
                  ? 'text-[#FAFAFA] font-medium'
                  : h.level === 2
                  ? 'text-[#A3A3A3] pl-4'
                  : 'text-[#737373] pl-7 text-[11px]'
              }`}
            >
              <Hash className="h-3 w-3 text-[#505050] flex-shrink-0" />
              <span className="truncate">{h.text}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
