'use client';

import React, { useState, useEffect } from 'react';
import { api, DeveloperTokenItem } from '@/lib/api';
import {
  X,
  Code2,
  Key,
  Copy,
  Check,
  Trash2,
  Terminal,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface DeveloperTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeveloperTokenModal({ isOpen, onClose }: DeveloperTokenModalProps) {
  const [tokens, setTokens] = useState<DeveloperTokenItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('My Local CLI');
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTokens();
      setCreatedToken(null);
      setError(null);
    }
  }, [isOpen]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const res = await api.getDeveloperTokens();
      if (res.success && res.data?.tokens) {
        setTokens(res.data.tokens);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load developer tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    try {
      const res = await api.createDeveloperToken({
        name: name.trim(),
        expiresInDays,
      });

      const tokenVal = res.data?.token || res.data?.rawToken;
      if (res.success && tokenVal) {
        setCreatedToken(tokenVal);
        setName('My Local CLI');
        await loadTokens();
      } else {
        setError(res.error?.message || 'Failed to generate developer token');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating token');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this developer token? CLI sessions using it will immediately lose access.')) {
      return;
    }
    try {
      const res = await api.revokeDeveloperToken(id);
      if (res.success) {
        await loadTokens();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to revoke token');
    }
  };

  const copyToClipboard = (text: string, isSnippet = false) => {
    navigator.clipboard.writeText(text);
    if (isSnippet) {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="w-full max-w-2xl rounded-[var(--radius-sm)] bg-[#0C0C0C] border border-[#262626] shadow-2xl text-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-[#121212]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded bg-cyan-950/40 border border-cyan-800/40 text-cyan-400">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">DEVELOPER CLI & VS CODE TOKENS</h3>
              <p className="text-[11px] text-neutral-500 font-sans">
                Authenticate local terminal tools & the Atlas VS Code extension
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-[#1E1E1E] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {error && (
            <div className="p-3 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Just-created raw token banner */}
          {createdToken && (
            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/60 text-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-white">NEW DEVELOPER TOKEN GENERATED</span>
                </div>
                <span className="text-[10px] text-emerald-400/80">Copy now • Will not be shown again</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded bg-black border border-emerald-900/50">
                <code className="flex-1 text-[11px] font-mono text-emerald-300 break-all select-all">
                  {createdToken}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdToken)}
                  className="px-2.5 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 font-sans text-xs flex items-center gap-1 transition-colors"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div>
                <p className="text-[11px] text-neutral-400 mb-1.5 font-sans">
                  Quick login in your local repository terminal:
                </p>
                <div className="flex items-center justify-between p-2 rounded bg-[#090909] border border-[#222222]">
                  <code className="text-[11px] text-cyan-300 font-mono">
                    atlas login --token {createdToken}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`atlas login --token ${createdToken}`, true)}
                    className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 font-sans"
                  >
                    {copiedSnippet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Token Form */}
          <div className="p-4 rounded-lg bg-[#141414] border border-[#222222] space-y-3">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-neutral-400" />
              CREATE DEVELOPER ACCESS TOKEN
            </span>

            <form onSubmit={handleCreateToken} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase text-neutral-500 block mb-1">Token Label</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. MacBook Pro CLI or CI Bot"
                  className="w-full bg-[#1A1A1A] border border-[#2D2D2D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-400"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-neutral-500 block mb-1">Expiry</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full bg-[#1A1A1A] border border-[#2D2D2D] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-400"
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={180}>180 Days</option>
                  <option value={365}>1 Year</option>
                </select>
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="px-4 py-1.5 rounded bg-neutral-200 hover:bg-white text-black font-semibold text-xs disabled:opacity-40 transition-colors"
                >
                  Generate Token
                </button>
              </div>
            </form>
          </div>

          {/* Active Tokens List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300">ACTIVE TOKENS</span>
              <span className="text-[11px] text-neutral-500">{tokens.length} token(s) configured</span>
            </div>

            <div className="space-y-2">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded bg-[#141414] border border-[#222222] flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-xs">{t.name}</span>
                      <span className="text-[10px] font-mono text-neutral-500 bg-[#1A1A1A] px-1.5 py-0.5 rounded border border-[#262626]">
                        {t.tokenPrefix ? `${t.tokenPrefix}...` : 'atlas_dev_...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-neutral-500 mt-1 font-sans">
                      <span>Created: {new Date(t.createdAt).toLocaleDateString()}</span>
                      {t.lastUsedAt && (
                        <span>Last used: {new Date(t.lastUsedAt).toLocaleDateString()}</span>
                      )}
                      <span>Expires: {t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevoke(t.id)}
                    title="Revoke Token"
                    className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {tokens.length === 0 && !loading && (
                <div className="p-6 rounded border border-dashed border-[#262626] text-center text-xs text-neutral-500 font-sans">
                  No active developer tokens. Generate one above to connect your local terminal or VS Code extension.
                </div>
              )}
            </div>
          </div>

          {/* CLI Instructions snippet */}
          <div className="p-4 rounded-lg bg-[#101010] border border-[#222222] space-y-2 text-neutral-400 font-sans text-xs">
            <span className="text-xs font-semibold text-white font-mono flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              CLI WORKFLOW QUICKSTART
            </span>
            <div className="space-y-1 text-[11px] leading-relaxed">
              <p>1. Authenticate in terminal: <code className="text-cyan-300 font-mono">atlas login --token &lt;YOUR_TOKEN&gt;</code></p>
              <p>2. Connect Git repository: <code className="text-cyan-300 font-mono">atlas connect</code></p>
              <p>3. Fetch assigned tasks: <code className="text-cyan-300 font-mono">atlas tasks</code></p>
              <p>4. Claim & start: <code className="text-cyan-300 font-mono">atlas task start TASK-xxx</code></p>
              <p>5. Run checks & submit verified evidence: <code className="text-cyan-300 font-mono">atlas task submit TASK-xxx</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
