'use client';

import React, { useState } from 'react';
import { type Editor } from '@tiptap/react';
import { Search, Replace, ChevronDown, ChevronUp, X, Check } from 'lucide-react';

interface FindReplaceProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FindReplace({ editor, isOpen, onClose }: FindReplaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);

  if (!isOpen || !editor) return null;

  const handleFind = () => {
    if (!searchTerm.trim()) {
      setMatchCount(0);
      return;
    }

    const text = editor.getText();
    const regex = new RegExp(searchTerm, 'gi');
    const matches = text.match(regex);
    setMatchCount(matches ? matches.length : 0);
  };

  const handleReplaceOne = () => {
    if (!searchTerm.trim()) return;
    const currentHtml = editor.getHTML();
    const updatedHtml = currentHtml.replace(new RegExp(searchTerm, 'i'), replaceTerm);
    editor.commands.setContent(updatedHtml);
    handleFind();
  };

  const handleReplaceAll = () => {
    if (!searchTerm.trim()) return;
    const currentHtml = editor.getHTML();
    const updatedHtml = currentHtml.replace(new RegExp(searchTerm, 'gi'), replaceTerm);
    editor.commands.setContent(updatedHtml);
    setMatchCount(0);
  };

  return (
    <div className="absolute top-12 right-6 z-40 bg-[#121212] border border-[#2D2D2D] rounded-[var(--radius-sm)] shadow-2xl p-3 w-80 font-mono text-xs space-y-2.5 animate-slide-down select-none">
      <div className="flex items-center justify-between border-b border-[#222222] pb-1.5 text-[#FAFAFA]">
        <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider">
          <Search className="h-3.5 w-3.5 text-[#FAFAFA]" />
          <span>FIND & REPLACE</span>
        </div>
        <button type="button" onClick={onClose} className="text-[#737373] hover:text-[#FAFAFA]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Find Input */}
      <div className="flex items-center gap-1.5 bg-[#0D0D0D] border border-[#222222] px-2 py-1 rounded-[2px]">
        <input
          type="text"
          autoFocus
          placeholder="Find in document..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (e.target.value) {
              const text = editor.getText();
              const regex = new RegExp(e.target.value, 'gi');
              const matches = text.match(regex);
              setMatchCount(matches ? matches.length : 0);
            } else {
              setMatchCount(null);
            }
          }}
          className="flex-1 bg-transparent text-xs text-[#FAFAFA] placeholder-[#505050] focus:outline-none"
        />
        {matchCount !== null && (
          <span className="text-[10px] text-[#737373] flex-shrink-0">
            {matchCount} {matchCount === 1 ? 'match' : 'matches'}
          </span>
        )}
      </div>

      {/* Replace Input */}
      <div className="flex items-center gap-1.5 bg-[#0D0D0D] border border-[#222222] px-2 py-1 rounded-[2px]">
        <input
          type="text"
          placeholder="Replace with..."
          value={replaceTerm}
          onChange={(e) => setReplaceTerm(e.target.value)}
          className="flex-1 bg-transparent text-xs text-[#FAFAFA] placeholder-[#505050] focus:outline-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-1 pt-1">
        <button
          type="button"
          onClick={handleReplaceOne}
          disabled={!searchTerm.trim() || matchCount === 0}
          className="flex-1 py-1 bg-[#1A1A1A] hover:bg-[#242424] text-[#FAFAFA] border border-[#2D2D2D] rounded-[2px] text-[10px] uppercase font-semibold disabled:opacity-30"
        >
          REPLACE
        </button>
        <button
          type="button"
          onClick={handleReplaceAll}
          disabled={!searchTerm.trim() || matchCount === 0}
          className="flex-1 py-1 bg-[#FAFAFA] hover:bg-[#E5E5E5] text-[#111111] rounded-[2px] text-[10px] uppercase font-semibold disabled:opacity-30"
        >
          REPLACE ALL
        </button>
      </div>
    </div>
  );
}
