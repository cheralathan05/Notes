'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api, TerminalExecutionData } from '@/lib/api';
import {
  Terminal as TerminalIcon,
  X,
  Minimize2,
  Maximize2,
  CornerDownLeft,
  ChevronRight,
  Trash2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface TerminalCommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskMutated?: () => void;
}

interface HistoryItem {
  id: string;
  command: string;
  output: string;
  success: boolean;
  timestamp: string;
}

export function TerminalCommandCenter({
  isOpen,
  onClose,
  onTaskMutated,
}: TerminalCommandCenterProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 'welcome',
      command: 'kronos --init',
      output:
        'KRONOS WORKSPACE OS - INTERACTIVE CLI v2.4\nType "help" for command catalog, or "task list" to view tasks.\nKeyboard shortcuts: [ArrowUp / ArrowDown] Command history, [Tab] Autocomplete.',
      success: true,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ text: string; description: string }>>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Fetch autocomplete suggestions as user types
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.getTerminalSuggestions(input);
        if (res.success && res.data?.suggestions) {
          setSuggestions(res.data.suggestions);
          setActiveSuggestion(0);
        }
      } catch {
        // Ignore suggestion failures silently
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [input]);

  const handleExecute = async (cmdToRun?: string) => {
    const rawCmd = (cmdToRun !== undefined ? cmdToRun : input).trim();
    if (!rawCmd) return;

    if (rawCmd.toLowerCase() === 'clear') {
      setHistory([]);
      setInput('');
      setSuggestions([]);
      return;
    }

    // Add to navigation history
    setCommandHistory((prev) => [...prev, rawCmd]);
    setHistoryIndex(-1);
    setInput('');
    setSuggestions([]);
    setIsExecuting(true);

    try {
      const res = await api.executeTerminalCommand(rawCmd);
      if (res.success && res.data) {
        const resultData = res.data;
        if (resultData.output === '__CLEAR__') {
          setHistory([]);
        } else {
          setHistory((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              command: rawCmd,
              output: resultData.output || (resultData.success ? '✓ Done.' : 'Command executed.'),
              success: resultData.success,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }

        // Trigger real-time visual UI synchronization!
        if (onTaskMutated) {
          onTaskMutated();
        }
      } else {
        setHistory((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            command: rawCmd,
            output: `Error: ${res.error?.message || 'Execution failed'}`,
            success: false,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          command: rawCmd,
          output: `Network Error: ${err.message || 'Could not reach server'}`,
          success: false,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // History up
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(commandHistory[nextIndex]);
      return;
    }

    // History down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex < commandHistory.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInput(commandHistory[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
      return;
    }

    // Autocomplete Tab
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      const chosen = suggestions[activeSuggestion]?.text;
      if (chosen) {
        setInput(chosen + ' ');
      }
      return;
    }

    // Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-200 flex flex-col font-mono shadow-2xl border border-[#262626] bg-[#0A0A0A] text-[#FAFAFA] ${
        isMaximized
          ? 'inset-4 rounded-xl'
          : 'bottom-4 right-4 w-[680px] max-w-[calc(100vw-32px)] h-[440px] rounded-xl'
      }`}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#141414] border-b border-[#262626] rounded-t-xl select-none">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 mr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#333333] border border-[#444444]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#333333] border border-[#444444]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#333333] border border-[#444444]" />
          </div>
          <TerminalIcon className="w-4 h-4 text-neutral-400" />
          <span className="text-xs font-semibold tracking-wider text-neutral-200">
            WORKSPACE COMMAND CENTER
          </span>
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#202020] text-neutral-400 border border-[#2e2e2e]">
            CLI
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleExecute('help')}
            title="Help"
            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-[#222222] rounded transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleExecute('clear')}
            title="Clear output"
            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-[#222222] rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore' : 'Maximize'}
            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-[#222222] rounded transition-colors"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-[#222222] rounded transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Output Console Log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs leading-relaxed selection:bg-neutral-800">
        {history.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center space-x-2 text-neutral-400">
              <ChevronRight className="w-3 h-3 text-neutral-500" />
              <span className="text-neutral-500">kronos:~$</span>
              <span className="text-[#FAFAFA] font-medium">{item.command}</span>
              <span className="text-[10px] text-neutral-600 ml-auto">{item.timestamp}</span>
            </div>
            <pre
              className={`p-2 rounded bg-[#101010] border border-[#1f1f1f] whitespace-pre-wrap font-mono text-xs overflow-x-auto ${
                item.success ? 'text-neutral-300' : 'text-rose-400 border-rose-950/40 bg-rose-950/10'
              }`}
            >
              {item.output}
            </pre>
          </div>
        ))}
        {isExecuting && (
          <div className="flex items-center space-x-2 text-neutral-400 py-1">
            <div className="w-2 h-2 rounded-full bg-neutral-400 animate-ping" />
            <span className="text-xs text-neutral-400">Executing authoritative domain operation...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Autocomplete Suggestions Drawer */}
      {suggestions.length > 0 && (
        <div className="px-3 py-1.5 bg-[#121212] border-t border-[#222222] flex items-center space-x-2 overflow-x-auto text-[11px]">
          <span className="text-neutral-500 text-[10px] uppercase font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-neutral-400" /> Suggestions:
          </span>
          {suggestions.slice(0, 4).map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(s.text + ' ');
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 rounded bg-[#1c1c1c] hover:bg-[#2a2a2a] border border-[#2b2b2b] text-neutral-300 whitespace-nowrap transition-colors flex items-center space-x-1.5"
            >
              <span className="font-semibold text-neutral-100">{s.text}</span>
              <span className="text-neutral-500 text-[10px]">({s.description})</span>
            </button>
          ))}
          <span className="text-neutral-600 text-[10px] ml-auto">Press Tab</span>
        </div>
      )}

      {/* Command Input Bar */}
      <div className="p-3 bg-[#0d0d0d] border-t border-[#222222] rounded-b-xl flex items-center space-x-2">
        <span className="text-neutral-500 text-xs font-semibold select-none flex items-center">
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Type a command (e.g. task list, task create "Fix API", help)...'
          disabled={isExecuting}
          className="flex-1 bg-transparent text-[#FAFAFA] text-xs placeholder:text-neutral-600 focus:outline-none font-mono"
        />
        <button
          onClick={() => handleExecute()}
          disabled={isExecuting || !input.trim()}
          className="p-1 px-2.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 text-xs flex items-center space-x-1 transition-colors border border-neutral-700"
        >
          <CornerDownLeft className="w-3 h-3" />
          <span className="text-[11px]">Run</span>
        </button>
      </div>
    </div>
  );
}
