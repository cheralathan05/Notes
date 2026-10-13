'use client';

import React, { useState, useEffect } from 'react';
import { type Editor } from '@tiptap/react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Table as TableIcon,
  Image as ImageIcon,
  Sparkles,
  Info,
} from 'lucide-react';

interface SlashCommandMenuProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenAi: () => void;
  onUploadImage: () => void;
}

export function SlashCommandMenu({
  editor,
  isOpen,
  onClose,
  onOpenAi,
  onUploadImage,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commandItems = [
    {
      title: 'Heading 1',
      description: 'Top-level section title',
      icon: Heading1,
      action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      title: 'Heading 2',
      description: 'Medium section title',
      icon: Heading2,
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: 'Heading 3',
      description: 'Subsection subheader',
      icon: Heading3,
      action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      title: 'Task Checklist',
      description: 'Track items with interactive checkboxes',
      icon: CheckSquare,
      action: () => editor?.chain().focus().toggleTaskList().run(),
    },
    {
      title: 'Bulleted List',
      description: 'Create a simple bulleted list',
      icon: List,
      action: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      title: 'Numbered List',
      description: 'Create an ordered sequence',
      icon: ListOrdered,
      action: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      title: 'Blockquote',
      description: 'Highlight a quotation or architectural callout',
      icon: Quote,
      action: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      title: 'Code Block',
      description: 'Syntax-highlighted code snippet',
      icon: Code,
      action: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
    {
      title: 'Table (3x3)',
      description: 'Insert structured tabular data with row/col controls',
      icon: TableIcon,
      action: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      title: 'Upload Image',
      description: 'Attach or embed an image file',
      icon: ImageIcon,
      action: onUploadImage,
    },
    {
      title: 'AI Co-Pilot',
      description: 'Open AI writing and transformation assistant',
      icon: Sparkles,
      action: onOpenAi,
    },
  ];

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < commandItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : commandItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commandItems[selectedIndex]?.action();
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, commandItems, onClose]);

  if (!isOpen) return null;

  return (
    <div className="absolute left-6 top-24 z-40 bg-[#121212] border border-[#2D2D2D] rounded-[var(--radius-sm)] shadow-2xl p-1.5 w-72 max-h-80 overflow-y-auto font-mono text-xs space-y-0.5 animate-slide-down select-none">
      <div className="px-2 py-1 text-[10px] text-[#737373] uppercase tracking-wider border-b border-[#1C1C1C] mb-1">
        INSERT BLOCK COMMANDS
      </div>

      {commandItems.map((cmd, idx) => {
        const isSelected = idx === selectedIndex;
        const Icon = cmd.icon;

        return (
          <button
            key={cmd.title}
            type="button"
            onMouseEnter={() => setSelectedIndex(idx)}
            onClick={() => {
              cmd.action();
              onClose();
            }}
            className={`w-full text-left p-2 rounded-[2px] flex items-center gap-2.5 transition-colors ${
              isSelected ? 'bg-[#1D1D1D] text-[#FAFAFA]' : 'text-[#A3A3A3] hover:bg-[#151515]'
            }`}
          >
            <div className={`p-1 rounded-[2px] ${isSelected ? 'bg-[#2A2A2A] text-[#FAFAFA]' : 'text-[#737373]'}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-xs text-[#FAFAFA]">{cmd.title}</div>
              <div className="text-[10px] text-[#737373] truncate">{cmd.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
