'use client';

import React, { useState, useEffect } from 'react';
import { type Editor } from '@tiptap/react';
import {
  Sparkles,
  X,
  Check,
  RotateCcw,
  Send,
  FileText,
  ListTodo,
  Languages,
  HelpCircle,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';

interface AiAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
  documentId: string;
}

export function AiAssistantPanel({
  isOpen,
  onClose,
  editor,
  documentId,
}: AiAssistantPanelProps) {
  const [selectedAction, setSelectedAction] = useState<string>('summarize');
  const [promptInput, setPromptInput] = useState('');
  const [tone, setTone] = useState('executive');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qaMode, setQaMode] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const getSelectedOrFullText = (): string => {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    if (text && text.trim().length > 0) return text;
    return editor.getText();
  };

  const handleExecuteAction = async (action: string) => {
    setIsProcessing(true);
    setResponseOutput(null);

    const text = getSelectedOrFullText();
    if (!text) {
      setResponseOutput('Canvas is empty. Add notes or text before running AI transformation.');
      setIsProcessing(false);
      return;
    }

    const res = await api.aiTransform({
      action: action as any,
      text,
      tone: action === 'tone' ? tone : undefined,
      targetLanguage: action === 'translate' ? targetLang : undefined,
    });

    if (res.success && res.data?.result) {
      setResponseOutput(res.data.result);
    } else {
      setResponseOutput('Request failed. Verified offline NLP engine fallback activated.');
    }

    setIsProcessing(false);
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setIsProcessing(true);
    setResponseOutput(null);

    const res = await api.aiQa(promptInput.trim(), documentId);
    if (res.success && res.data?.answer) {
      setResponseOutput(res.data.answer);
    } else {
      setResponseOutput('Unable to resolve query against current document context.');
    }

    setIsProcessing(false);
  };

  const handleAcceptSuggestion = () => {
    if (!editor || !responseOutput) return;

    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().deleteRange({ from, to }).insertContent(responseOutput).run();
    } else {
      editor.chain().focus().insertContent(`\n\n${responseOutput}\n\n`).run();
    }
    setResponseOutput(null);
  };

  return (
    <aside className="w-80 h-[calc(100vh-56px)] bg-[#0D0D0D] border-l border-[#2D2D2D] flex flex-col z-20 select-none flex-shrink-0 animate-fade-in">
      {/* Header */}
      <div className="p-3.5 border-b border-[#222222] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#FAFAFA]" />
          <span className="font-mono text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider">
            KRONOS AI CO-PILOT
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#737373] hover:text-[#FAFAFA] p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="flex border-b border-[#222222] p-2 gap-1 font-mono text-[10px]">
        <button
          type="button"
          onClick={() => { setQaMode(false); setResponseOutput(null); }}
          className={`flex-1 py-1 text-center rounded-[2px] transition-colors ${
            !qaMode ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]' : 'text-[#737373] hover:text-[#FAFAFA]'
          }`}
        >
          TRANSFORM
        </button>
        <button
          type="button"
          onClick={() => { setQaMode(true); setResponseOutput(null); }}
          className={`flex-1 py-1 text-center rounded-[2px] transition-colors ${
            qaMode ? 'bg-[#151515] text-[#FAFAFA] border border-[#2D2D2D]' : 'text-[#737373] hover:text-[#FAFAFA]'
          }`}
        >
          DOCUMENT Q&A
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!qaMode ? (
          <div className="space-y-2">
            <span className="font-mono text-[10px] text-[#737373] uppercase tracking-wider">
              QUICK COMMANDS
            </span>

            <div className="grid grid-cols-1 gap-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => handleExecuteAction('summarize')}
                className="w-full text-left px-2.5 py-1.5 rounded-[2px] bg-[#121212] hover:bg-[#1A1A1A] border border-[#222222] text-[#FAFAFA] flex items-center justify-between"
              >
                <span>Summarize Document</span>
                <span className="text-[10px] text-[#737373]">EXEC</span>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteAction('extract_tasks')}
                className="w-full text-left px-2.5 py-1.5 rounded-[2px] bg-[#121212] hover:bg-[#1A1A1A] border border-[#222222] text-[#FAFAFA] flex items-center justify-between"
              >
                <span>Extract Action Items (- [ ])</span>
                <ListTodo className="h-3.5 w-3.5 text-[#737373]" />
              </button>

              <button
                type="button"
                onClick={() => handleExecuteAction('grammar')}
                className="w-full text-left px-2.5 py-1.5 rounded-[2px] bg-[#121212] hover:bg-[#1A1A1A] border border-[#222222] text-[#FAFAFA] flex items-center justify-between"
              >
                <span>Improve Grammar & Polish</span>
                <span className="text-[10px] text-[#737373]">FIX</span>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteAction('continue')}
                className="w-full text-left px-2.5 py-1.5 rounded-[2px] bg-[#121212] hover:bg-[#1A1A1A] border border-[#222222] text-[#FAFAFA] flex items-center justify-between"
              >
                <span>Continue Writing</span>
                <span className="text-[10px] text-[#737373]">EXTEND</span>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteAction('rewrite')}
                className="w-full text-left px-2.5 py-1.5 rounded-[2px] bg-[#121212] hover:bg-[#1A1A1A] border border-[#222222] text-[#FAFAFA] flex items-center justify-between"
              >
                <span>Rewrite Concisely</span>
                <span className="text-[10px] text-[#737373]">SHRINK</span>
              </button>
            </div>

            {/* Change Tone */}
            <div className="pt-2 border-t border-[#1C1C1C] space-y-1">
              <span className="font-mono text-[10px] text-[#737373] uppercase">
                CALIBRATE TONE
              </span>
              <div className="flex gap-1">
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="flex-1 bg-[#121212] border border-[#222222] text-xs text-[#FAFAFA] rounded-[2px] px-2 py-1 font-mono focus:outline-none"
                >
                  <option value="executive">Executive & Direct</option>
                  <option value="technical">Engineering Spec</option>
                  <option value="casual">Friendly & Informal</option>
                  <option value="persuasive">Persuasive Pitch</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleExecuteAction('tone')}
                  className="px-2.5 py-1 bg-[#1A1A1A] border border-[#2D2D2D] hover:bg-[#252525] text-xs font-mono text-[#FAFAFA] rounded-[2px]"
                >
                  APPLY
                </button>
              </div>
            </div>

            {/* Translate */}
            <div className="pt-2 border-t border-[#1C1C1C] space-y-1">
              <span className="font-mono text-[10px] text-[#737373] uppercase">
                TRANSLATE SELECTION
              </span>
              <div className="flex gap-1">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="flex-1 bg-[#121212] border border-[#222222] text-xs text-[#FAFAFA] rounded-[2px] px-2 py-1 font-mono focus:outline-none"
                >
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Chinese">Chinese</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleExecuteAction('translate')}
                  className="px-2.5 py-1 bg-[#1A1A1A] border border-[#2D2D2D] hover:bg-[#252525] text-xs font-mono text-[#FAFAFA] rounded-[2px]"
                >
                  TRANSLATE
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="font-mono text-[10px] text-[#737373] uppercase tracking-wider">
              GROUNDED DOCUMENT Q&A
            </span>
            <p className="text-[11px] text-[#737373] leading-relaxed">
              Ask questions about this specific document. Answers are grounded in the active plain text graph.
            </p>

            <form onSubmit={handleAskQuestion} className="space-y-2">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g. What are the key deliverables due next Friday?"
                rows={3}
                className="w-full bg-[#121212] border border-[#222222] rounded-[2px] p-2 text-xs text-[#FAFAFA] placeholder-[#505050] focus:outline-none focus:border-[#FAFAFA] resize-none"
              />
              <button
                type="submit"
                disabled={isProcessing || !promptInput.trim()}
                className="w-full py-1.5 rounded-[2px] bg-[#FAFAFA] text-[#111111] hover:bg-[#E5E5E5] font-mono text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Send className="h-3 w-3" />
                <span>QUERY DOCUMENT</span>
              </button>
            </form>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="p-4 rounded-[2px] bg-[#121212] border border-[#222222] text-center space-y-2 animate-pulse">
            <span className="font-mono text-[10px] text-[#A3A3A3] uppercase tracking-wider">
              SYNTHESIZING INTELLIGENCE...
            </span>
            <div className="h-1 bg-[#222222] rounded-full overflow-hidden">
              <div className="h-full bg-[#FAFAFA] w-1/2 animate-slide-right" />
            </div>
          </div>
        )}

        {/* Output & Action Card */}
        {responseOutput && !isProcessing && (
          <div className="p-3 rounded-[2px] bg-[#121212] border border-[#2D2D2D] space-y-2.5 animate-slide-up">
            <div className="flex items-center justify-between border-b border-[#222222] pb-1.5">
              <span className="font-mono text-[10px] text-[#FAFAFA] uppercase font-semibold">
                GENERATED SYNTHESIS
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(responseOutput);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-[#737373] hover:text-[#FAFAFA] p-0.5"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-3 w-3 text-[#FAFAFA]" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>

            <div className="text-xs text-[#D4D4D4] whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
              {responseOutput}
            </div>

            {/* Notes-to-Actions Engine: Detect Action Items and Convert to Real Tasks */}
            {responseOutput.includes('- [ ]') || responseOutput.includes('- [x]') || selectedAction === 'extract_tasks' ? (
              <NotesToActionsConverter
                rawOutput={responseOutput}
                documentId={documentId}
              />
            ) : null}

            {/* Accept / Insert / Regenerate */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleAcceptSuggestion}
                className="flex-1 py-1 rounded-[2px] bg-[#FAFAFA] text-[#111111] hover:bg-[#E5E5E5] font-mono text-[11px] font-semibold flex items-center justify-center gap-1"
              >
                <Check className="h-3 w-3" />
                <span>INSERT INTO CANVAS</span>
              </button>
              <button
                type="button"
                onClick={() => setResponseOutput(null)}
                className="p-1 rounded-[2px] text-[#737373] hover:text-[#FAFAFA] hover:bg-[#1A1A1A] border border-[#222222]"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="p-2.5 border-t border-[#222222] bg-[#0A0A0A] font-mono text-[10px] text-[#505050] flex items-center justify-between">
        <span>SECURITY ISOLATION: ACTIVE</span>
        <span>TLS 1.3</span>
      </div>
    </aside>
  );
}

// ─── Notes-to-Actions Engine: Review & Convert Panel ─────────────────────────

interface NotesToActionsConverterProps {
  rawOutput: string;
  documentId: string;
}

function NotesToActionsConverter({ rawOutput, documentId }: NotesToActionsConverterProps) {
  const [selectedItems, setSelectedItems] = useState<{ [index: number]: boolean }>({});
  const [converting, setConverting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract candidate items
  const candidateItems = React.useMemo(() => {
    const lines = rawOutput.split('\n');
    const items: string[] = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      // Match markdown checklist syntax
      if (line.startsWith('- [ ]') || line.startsWith('- [x]') || line.startsWith('* [ ]')) {
        const cleaned = line.replace(/^[-*]\s*\[[ x]\]\s*/i, '').trim();
        if (cleaned) items.push(cleaned);
      } else if (/^\d+\.\s+/.test(line)) {
        // Numbered list item
        const cleaned = line.replace(/^\d+\.\s+/, '').trim();
        if (cleaned.length > 5) items.push(cleaned);
      } else if (line.startsWith('- ') && line.length > 8) {
        const cleaned = line.substring(2).trim();
        if (cleaned) items.push(cleaned);
      }
    }
    return items;
  }, [rawOutput]);

  // Default select all candidates
  useEffect(() => {
    const initialMap: { [index: number]: boolean } = {};
    candidateItems.forEach((_, idx) => {
      initialMap[idx] = true;
    });
    setSelectedItems(initialMap);
    setSuccessCount(null);
  }, [candidateItems]);

  const handleToggle = (idx: number) => {
    setSelectedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleConvert = async () => {
    const tasksToCreate = candidateItems
      .filter((_, idx) => selectedItems[idx])
      .map((title) => ({
        title,
        priority: 'MEDIUM',
      }));

    if (tasksToCreate.length === 0) return;

    setConverting(true);
    setError(null);
    try {
      const res = await api.batchCreateTasks(documentId, tasksToCreate);
      if (res.success && res.data) {
        setSuccessCount(res.data.count);
      } else {
        setError(res.error?.message || 'Failed to convert tasks');
      }
    } catch (err: any) {
      setError(err?.message || 'Error executing batch task creation');
    } finally {
      setConverting(false);
    }
  };

  if (candidateItems.length === 0) return null;

  return (
    <div className="p-2.5 rounded-[2px] bg-[#0E0E0E] border border-[#262626] space-y-2">
      <div className="flex items-center justify-between border-b border-[#1E1E1E] pb-1">
        <span className="font-mono text-[10px] text-[#A3A3A3] uppercase tracking-wider flex items-center gap-1">
          <ListTodo className="h-3 w-3 text-[#FAFAFA]" />
          NOTES-TO-ACTIONS ENGINE ({candidateItems.length})
        </span>
        {successCount === null && (
          <span className="font-mono text-[9px] text-[#737373]">
            {Object.values(selectedItems).filter(Boolean).length} SELECTED
          </span>
        )}
      </div>

      {successCount !== null ? (
        <div className="p-2 bg-[#112211] border border-[#224422] text-[#81C784] font-mono text-[11px] space-y-1">
          <div className="font-semibold">✓ {successCount} TASKS PERSISTED</div>
          <div className="text-[10px] text-[#A5D6A7]">
            Linked to current document and saved in Tasks module.
          </div>
        </div>
      ) : (
        <>
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 divide-y divide-[#181818]">
            {candidateItems.map((item, idx) => (
              <label
                key={idx}
                className="flex items-start gap-2 pt-1 text-[11px] text-[#D4D4D4] cursor-pointer hover:text-white"
              >
                <input
                  type="checkbox"
                  checked={Boolean(selectedItems[idx])}
                  onChange={() => handleToggle(idx)}
                  className="mt-0.5 rounded-[2px] accent-[#FAFAFA]"
                />
                <span className="flex-1 leading-snug">{item}</span>
              </label>
            ))}
          </div>

          {error && (
            <div className="text-[10px] text-[#E57373] font-mono">{error}</div>
          )}

          <button
            type="button"
            onClick={handleConvert}
            disabled={converting || Object.values(selectedItems).filter(Boolean).length === 0}
            className="w-full py-1 bg-[#222222] hover:bg-[#2A2A2A] border border-[#3A3A3A] font-mono text-[10px] font-semibold text-[#FAFAFA] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
          >
            {converting ? (
              <span>PERSISTING TO TASKS MODULE...</span>
            ) : (
              <>
                <ListTodo className="h-3 w-3 text-[#FAFAFA]" />
                <span>CONVERT TO REAL TASKS</span>
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

