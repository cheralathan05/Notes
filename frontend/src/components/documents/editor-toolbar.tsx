'use client';

import React, { useState } from 'react';
import { type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error';
  isFullWidth: boolean;
  onToggleFullWidth: () => void;
  onInsertImage: () => void;
}

export function EditorToolbar({
  editor,
  saveStatus,
  isFullWidth,
  onToggleFullWidth,
  onInsertImage,
}: EditorToolbarProps) {
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!editor) return null;

  const setLink = () => {
    if (!linkUrl) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  const statusIndicators = {
    saved: { label: 'PERSISTED // SAVED', color: 'text-[#A3A3A3]', dot: 'bg-[#FAFAFA]' },
    saving: { label: 'TRANSMITTING...', color: 'text-[#FAFAFA]', dot: 'bg-[#A3A3A3] animate-pulse' },
    unsaved: { label: 'UNSAVED CHANGES', color: 'text-[#737373]', dot: 'bg-[#505050]' },
    conflict: { label: '409 CONFLICT // SYNC REQUIRED', color: 'text-[#FAFAFA]', dot: 'bg-[#FAFAFA]' },
    error: { label: 'TRANSMISSION ERROR', color: 'text-[#A3A3A3]', dot: 'bg-[#737373]' },
  };

  const currentStatus = statusIndicators[saveStatus];

  return (
    <div className="sticky top-0 z-30 bg-[#080808]/95 backdrop-blur-md border-b border-[#222222] px-4 py-2 flex flex-wrap items-center justify-between gap-2 select-none">
      {/* ─── Left: Formatting Controls ─── */}
      <div className="flex flex-wrap items-center gap-0.5">
        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Heading 1"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('heading', { level: 3 })
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </button>

        <span className="w-[1px] h-4 bg-[#222222] mx-1" />

        {/* Text styling */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('bold')
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Bold (⌘B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('italic')
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Italic (⌘I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('underline')
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Underline (⌘U)"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('strike')
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('code')
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Inline Code"
        >
          <Code className="h-3.5 w-3.5" />
        </button>

        <span className="w-[1px] h-4 bg-[#222222] mx-1" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive({ textAlign: 'left' })
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Align Left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive({ textAlign: 'center' })
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Align Center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive({ textAlign: 'right' })
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Align Right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>

        <span className="w-[1px] h-4 bg-[#222222] mx-1" />

        {/* Lists & Blocks */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Bulleted List"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('orderedList')
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('taskList')
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Task Checklist"
        >
          <CheckSquare className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded-[2px] transition-colors ${
            editor.isActive('blockquote')
              ? 'bg-[#222222] text-[#FAFAFA]'
              : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
          }`}
          title="Blockquote"
        >
          <Quote className="h-3.5 w-3.5" />
        </button>

        <span className="w-[1px] h-4 bg-[#222222] mx-1" />

        {/* Tables */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTableMenu(!showTableMenu)}
            className={`p-1.5 rounded-[2px] transition-colors ${
              editor.isActive('table')
                ? 'bg-[#222222] text-[#FAFAFA]'
                : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
            }`}
            title="Table Operations"
          >
            <TableIcon className="h-3.5 w-3.5" />
          </button>

          {showTableMenu && (
            <div className="absolute left-0 top-full mt-1 w-48 rounded-[2px] bg-[#151515] border border-[#2D2D2D] shadow-xl p-1 z-40 text-xs font-mono space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-[#222222] rounded-[2px] text-[#FAFAFA]"
              >
                Insert 3x3 Table
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().addRowAfter().run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-[#222222] rounded-[2px] text-[#A3A3A3]"
              >
                Add Row Below
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().addColumnAfter().run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-[#222222] rounded-[2px] text-[#A3A3A3]"
              >
                Add Column Right
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteRow().run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-[#222222] rounded-[2px] text-[#A3A3A3]"
              >
                Delete Row
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteColumn().run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-[#222222] rounded-[2px] text-[#A3A3A3]"
              >
                Delete Column
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteTable().run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-[#222222] rounded-[2px] text-[#FAFAFA]"
              >
                Delete Entire Table
              </button>
            </div>
          )}
        </div>

        {/* Link Modal / Input */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLinkInput(!showLinkInput)}
            className={`p-1.5 rounded-[2px] transition-colors ${
              editor.isActive('link')
                ? 'bg-[#222222] text-[#FAFAFA]'
                : 'text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414]'
            }`}
            title="Hyperlink"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>

          {showLinkInput && (
            <div className="absolute left-0 top-full mt-1 flex items-center gap-1 bg-[#151515] border border-[#2D2D2D] p-1.5 rounded-[2px] z-40">
              <input
                type="url"
                autoFocus
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setLink()}
                className="bg-[#101010] border border-[#2D2D2D] px-2 py-1 text-xs text-[#FAFAFA] rounded-[2px] focus:outline-none w-48"
              />
              <button
                type="button"
                onClick={setLink}
                className="px-2 py-1 bg-[#FAFAFA] text-[#111111] font-mono text-[10px] rounded-[2px]"
              >
                APPLY
              </button>
            </div>
          )}
        </div>

        {/* Image Upload */}
        <button
          type="button"
          onClick={onInsertImage}
          className="p-1.5 rounded-[2px] text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414] transition-colors"
          title="Upload / Insert Image"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>

        <span className="w-[1px] h-4 bg-[#222222] mx-1" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded-[2px] text-[#737373] hover:text-[#FAFAFA] disabled:opacity-30 disabled:hover:text-[#737373]"
          title="Undo (⌘Z)"
        >
          <Undo className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded-[2px] text-[#737373] hover:text-[#FAFAFA] disabled:opacity-30 disabled:hover:text-[#737373]"
          title="Redo (⌘⇧Z)"
        >
          <Redo className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ─── Right: Save Status & Layout Toggle ─── */}
      <div className="flex items-center gap-3 font-mono text-[10px]">
        {/* Concurrency Safe Save Status */}
        <div className={`flex items-center gap-1.5 tracking-wider uppercase ${currentStatus.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.dot}`} />
          <span>{currentStatus.label}</span>
        </div>

        {/* Full width canvas toggle */}
        <button
          type="button"
          onClick={onToggleFullWidth}
          className="p-1 rounded-[2px] text-[#737373] hover:text-[#FAFAFA] hover:bg-[#141414] transition-colors"
          title={isFullWidth ? 'Standard Reading Margins' : 'Full Width Canvas'}
        >
          {isFullWidth ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
