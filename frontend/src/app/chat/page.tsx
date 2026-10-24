'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, ChatChannelItem, ChatMessageItem } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useWorkspace } from '@/context/workspace-context';
import {
  MessageSquare,
  Hash,
  Lock,
  Plus,
  Send,
  Smile,
  Pin,
  Trash2,
  Edit2,
  Reply,
  Users,
  Search,
  Code,
  Check,
  Flame,
  ThumbsUp,
  Heart,
  Rocket,
  Eye,
  Info,
  Clock,
  ChevronDown,
  X,
  Shield,
  Globe,
  Copy,
  CheckCheck,
  UserPlus,
} from 'lucide-react';

const REACTION_EMOJIS = ['👍', '❤️', '🚀', '🔥', '👀', '🎉'];

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export default function ChatPage() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  // Channels state
  const [channels, setChannels] = useState<ChatChannelItem[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [channelError, setChannelError] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessageItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

  // Interactive controls
  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessageItem | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false);
  const [createChannelLoading, setCreateChannelLoading] = useState(false);
  const [createChannelError, setCreateChannelError] = useState<string | null>(null);

  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [channelMembers, setChannelMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');

  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editTopicValue, setEditTopicValue] = useState('');

  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('typescript');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ─── 1. Load Channels ──────────────────────────────────────────────────────
  const loadChannels = async () => {
    try {
      const res = await api.getChatChannels();
      if (res.success && res.data) {
        setChannels(res.data.channels);
        setChannelError(null);
      }
    } catch (err: any) {
      console.error('Failed to load channels:', err);
    }
  };

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadChannels();
    }
  }, [currentWorkspace?.id]);

  // ─── 2. Real-Time SSE Stream Integration ──────────────────────────────────
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    let isMounted = true;
    let sse: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        setConnectionState('connecting');
        const sseUrl = `/api/collaboration/realtime?workspaceId=${encodeURIComponent(currentWorkspace.id)}`;
        sse = new EventSource(sseUrl, { withCredentials: true });
        eventSourceRef.current = sse;

        sse.onopen = () => {
          if (isMounted) setConnectionState('connected');
        };

        sse.onerror = () => {
          if (isMounted) {
            setConnectionState('disconnected');
            sse?.close();
            retryTimeout = setTimeout(connectSSE, 5000);
          }
        };

        // Listen for chat events
        sse.addEventListener('chat:message', (evt: MessageEvent) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(evt.data);
            const payload = parsed.data || parsed;
            const newMsg = payload.message;
            const channel = payload.channel || payload.channelId;

            if (newMsg) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                if (channel === activeChannel || newMsg.channel === activeChannel) {
                  return [...prev, newMsg];
                }
                return prev;
              });

              // Update channel message count in sidebar
              setChannels((prev) =>
                prev.map((c) =>
                  c.name === channel || c.id === channel
                    ? {
                        ...c,
                        messageCount: c.messageCount + 1,
                        lastMessage: {
                          id: newMsg.id,
                          content: newMsg.content,
                          createdAt: newMsg.createdAt,
                          author: newMsg.user?.displayName || 'User',
                        },
                      }
                    : c
                )
              );
            }
          } catch (e) {
            console.error('SSE chat:message parse error:', e);
          }
        });

        sse.addEventListener('chat:edited', (evt: MessageEvent) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(evt.data);
            const payload = parsed.data || parsed;
            const updatedMsg = payload.message;
            if (updatedMsg) {
              setMessages((prev) =>
                prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
              );
            }
          } catch (e) {}
        });

        sse.addEventListener('chat:deleted', (evt: MessageEvent) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(evt.data);
            const payload = parsed.data || parsed;
            const msgId = payload.messageId;
            if (msgId) {
              setMessages((prev) => prev.filter((m) => m.id !== msgId));
            }
          } catch (e) {}
        });

        sse.addEventListener('chat:reaction', (evt: MessageEvent) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(evt.data);
            const payload = parsed.data || parsed;
            const { messageId, reactions } = payload;
            if (messageId && reactions) {
              setMessages((prev) =>
                prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
              );
            }
          } catch (e) {}
        });

        sse.addEventListener('chat:pin', (evt: MessageEvent) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(evt.data);
            const payload = parsed.data || parsed;
            const { messageId, pinned } = payload;
            if (messageId !== undefined) {
              setMessages((prev) =>
                prev.map((m) => (m.id === messageId ? { ...m, pinned } : m))
              );
            }
          } catch (e) {}
        });

        sse.addEventListener('chat:channel_created', () => {
          loadChannels();
        });

        sse.addEventListener('chat:channel_updated', () => {
          loadChannels();
        });
      } catch (err) {
        if (isMounted) setConnectionState('disconnected');
      }
    };

    connectSSE();

    // Fallback polling every 8s if disconnected
    const fallbackPoll = setInterval(() => {
      if (connectionState === 'disconnected') {
        fetchMessages(activeChannel, false);
      }
    }, 8000);

    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      clearInterval(fallbackPoll);
      if (sse) sse.close();
    };
  }, [currentWorkspace?.id, activeChannel]);

  // ─── 3. Fetch Messages on Channel Switch ───────────────────────────────────
  const fetchMessages = async (channelIdOrName: string, showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setChannelError(null);
    try {
      const res = await api.getChatMessages(channelIdOrName);
      if (res.success && res.data) {
        setMessages(res.data.messages || []);
      } else if (res.error) {
        setChannelError(res.error.message || 'Unable to access channel messages');
        setMessages([]);
      }
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      setChannelError(err?.message || 'Error loading channel');
      setMessages([]);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeChannel && currentWorkspace?.id) {
      fetchMessages(activeChannel, true);
    }
  }, [activeChannel, currentWorkspace?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (!isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // ─── 4. Message Operations ────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const content = inputText.trim();
    const replyToId = replyingToMessage?.id || null;

    setInputText('');
    setReplyingToMessage(null);
    setIsSending(true);

    try {
      const res = await api.sendChatMessage({
        channel: activeChannel,
        content,
        replyToId,
      });

      if (res.success && res.data?.message) {
        const sent = res.data.message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [...prev, sent];
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleEditSubmit = async (messageId: string) => {
    if (!editingText.trim()) return;
    try {
      const res = await api.editChatMessage(messageId, editingText.trim());
      if (res.success && res.data?.message) {
        const updated = res.data.message;
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m))
        );
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
    } finally {
      setEditingMessageId(null);
      setEditingText('');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await api.deleteChatMessage(messageId);
      if (res.success) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await api.toggleChatReaction(messageId, emoji);
      if (res.success && res.data?.message) {
        const msg = res.data.message;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? msg : m)));
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
    setActiveEmojiPickerMsgId(null);
  };

  const handleTogglePin = async (messageId: string) => {
    try {
      const res = await api.toggleChatPin(messageId);
      if (res.success && res.data?.message) {
        const msg = res.data.message;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? msg : m)));
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleCopyMessage = (msg: ChatMessageItem) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedMsgId(msg.id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // ─── 5. Channel Creation & Management ─────────────────────────────────────
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    setCreateChannelLoading(true);
    setCreateChannelError(null);

    try {
      const res = await api.createChatChannel({
        name: newChannelName.trim(),
        topic: newChannelTopic.trim() || undefined,
        description: newChannelDescription.trim() || undefined,
        isPrivate: newChannelIsPrivate,
      });

      if (res.success && res.data?.channel) {
        const created = res.data.channel;
        setShowCreateModal(false);
        setNewChannelName('');
        setNewChannelTopic('');
        setNewChannelDescription('');
        setNewChannelIsPrivate(false);
        await loadChannels();
        setActiveChannel(created.name);
      } else {
        setCreateChannelError(res.error?.message || 'Failed to create channel');
      }
    } catch (err: any) {
      setCreateChannelError(err?.message || 'Channel creation error');
    } finally {
      setCreateChannelLoading(false);
    }
  };

  const handleUpdateTopic = async () => {
    const activeObj = channels.find((c) => c.id === activeChannel || c.name === activeChannel);
    if (!activeObj) return;

    try {
      const res = await api.updateChatChannel(activeObj.id, { topic: editTopicValue.trim() });
      if (res.success) {
        setShowTopicModal(false);
        await loadChannels();
      }
    } catch (err) {
      console.error('Failed to update topic:', err);
    }
  };

  const loadChannelMembers = async () => {
    const activeObj = channels.find((c) => c.id === activeChannel || c.name === activeChannel);
    if (!activeObj) return;

    setLoadingMembers(true);
    try {
      const res = await api.getChatChannelMembers(activeObj.id);
      if (res.success && res.data) {
        setChannelMembers(res.data.members || []);
      }
    } catch (err) {
      console.error('Failed to load channel members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleInviteMember = async () => {
    const activeObj = channels.find((c) => c.id === activeChannel || c.name === activeChannel);
    if (!activeObj || !inviteUserId.trim()) return;

    try {
      const res = await api.addChatChannelMember(activeObj.id, inviteUserId.trim());
      if (res.success) {
        setInviteUserId('');
        await loadChannelMembers();
      }
    } catch (err) {
      console.error('Failed to add channel member:', err);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    const activeObj = channels.find((c) => c.id === activeChannel || c.name === activeChannel);
    if (!activeObj) return;

    try {
      const res = await api.removeChatChannelMember(activeObj.id, targetUserId);
      if (res.success) {
        await loadChannelMembers();
      }
    } catch (err) {
      console.error('Failed to remove channel member:', err);
    }
  };

  // ─── 6. Search Integration ────────────────────────────────────────────────
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const res = await api.searchChatMessages(query.trim(), activeChannel);
      if (res.success && res.data) {
        setSearchResults(res.data.results || []);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const activeChannelObj = channels.find(
    (c) => c.id === activeChannel || c.name === activeChannel
  );

  const displayedMessages = searchResults !== null ? searchResults : messages;
  const pinnedMessages = messages.filter((m) => m.pinned);

  // Markdown snippet inserter
  const handleInsertCodeSnippet = () => {
    if (!codeSnippet.trim()) return;
    const formatted = '\n```' + codeLanguage + '\n' + codeSnippet.trim() + '\n```\n';
    setInputText((prev) => (prev ? `${prev}\n${formatted}` : formatted));
    setCodeSnippet('');
    setShowCodeModal(false);
  };

  // ─── 7. Safe Markdown Renderer ────────────────────────────────────────────
  const renderFormattedContent = (content: string) => {
    // Check if contains code block ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderInlineMarkdown(content.substring(lastIndex, match.index), `text-${lastIndex}`));
      }

      const lang = match[1] || 'code';
      const code = match[2];
      parts.push(
        <div key={`code-${match.index}`} className="my-2 rounded-lg bg-[#0d0d0d] border border-zinc-800 overflow-hidden font-mono text-xs">
          <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/80 border-b border-zinc-800 text-[10px] text-zinc-400">
            <span>{lang}</span>
            <button
              onClick={() => navigator.clipboard.writeText(code)}
              className="hover:text-zinc-200 transition-colors"
              title="Copy code"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
          <pre className="p-3 text-zinc-200 overflow-x-auto whitespace-pre font-mono leading-relaxed">
            {code}
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(renderInlineMarkdown(content.substring(lastIndex), `text-${lastIndex}`));
    }

    return parts;
  };

  const renderInlineMarkdown = (text: string, keyPrefix: string) => {
    const lines = text.split('\n');
    return (
      <span key={keyPrefix}>
        {lines.map((line, lIdx) => {
          let renderedLine: React.ReactNode = line;

          // Blockquote
          if (line.startsWith('> ')) {
            return (
              <span key={lIdx} className="block border-l-2 border-emerald-500/60 pl-2 my-1 italic text-zinc-400">
                {line.substring(2)}
              </span>
            );
          }

          // Format bold **text** and inline code `code`
          const formatted = line.split(/(\*\*[^*]+\*\*|`[^`]+`|@\w+)/g).map((chunk, cIdx) => {
            if (chunk.startsWith('**') && chunk.endsWith('**')) {
              return <strong key={cIdx} className="font-semibold text-zinc-100">{chunk.slice(2, -2)}</strong>;
            }
            if (chunk.startsWith('`') && chunk.endsWith('`')) {
              return (
                <code key={cIdx} className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-emerald-400">
                  {chunk.slice(1, -1)}
                </code>
              );
            }
            if (chunk.startsWith('@')) {
              return (
                <span key={cIdx} className="font-mono text-emerald-400 bg-emerald-500/10 px-1 rounded font-medium">
                  {chunk}
                </span>
              );
            }
            return chunk;
          });

          return (
            <React.Fragment key={lIdx}>
              {formatted}
              {lIdx < lines.length - 1 && <br />}
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-[#080808] text-zinc-100 font-sans">
        {/* ─── Left Channels Drawer ─── */}
        <div className="w-64 shrink-0 border-r border-[#1a1a1a] bg-[#0c0c0c] flex flex-col">
          {/* Channel Header */}
          <div className="p-3.5 border-b border-[#1a1a1a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-xs font-semibold tracking-wider uppercase text-zinc-200">
                Channels
              </span>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Create new channel"
            >
              <Plus className="h-3 w-3" />
              <span>New</span>
            </button>
          </div>

          {/* Channel List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {channels.map((ch) => {
              const isActive = ch.name === activeChannel || ch.id === activeChannel;
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChannel(ch.name);
                    setSearchResults(null);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-mono transition-all text-left group ${
                    isActive
                      ? 'bg-zinc-800/90 text-white font-medium border border-zinc-700/80 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {ch.isPrivate ? (
                      <Lock className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                    ) : (
                      <Hash className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    )}
                    <span className="truncate">{ch.name}</span>
                  </div>
                  {ch.messageCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-zinc-900 text-zinc-500'
                      }`}
                    >
                      {ch.messageCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Real Connection Status Bar */}
          <div className="p-3 border-t border-[#1a1a1a] bg-[#090909]">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connectionState === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : connectionState === 'connecting'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="text-zinc-300">
                  {connectionState === 'connected'
                    ? 'Synchronized'
                    : connectionState === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected'}
                </span>
              </span>
              <span className="text-[10px] text-zinc-500 uppercase">
                {connectionState === 'connected' ? 'Live SSE' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Center Discussion View ─── */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0e0e0e]">
          {/* Channel Topbar */}
          <div className="h-14 shrink-0 px-4 border-b border-[#1a1a1a] flex items-center justify-between bg-zinc-950/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100 font-mono">
                {activeChannelObj?.isPrivate ? (
                  <Lock className="h-4 w-4 text-amber-400" />
                ) : (
                  <Hash className="h-4 w-4 text-emerald-400" />
                )}
                <span>{activeChannelObj?.name || activeChannel}</span>
              </div>
              <button
                onClick={() => {
                  setEditTopicValue(activeChannelObj?.topic || '');
                  setShowTopicModal(true);
                }}
                className="hidden sm:inline-block text-xs text-zinc-500 hover:text-zinc-300 truncate border-l border-zinc-800 pl-3 transition-colors text-left"
                title="Edit channel topic"
              >
                {activeChannelObj?.topic || activeChannelObj?.description || 'Click to set topic'}
              </button>
            </div>

            {/* Right Tools & Member Drawer Trigger */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-36 sm:w-48 font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {pinnedMessages.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-mono text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                  <Pin className="h-3 w-3" />
                  <span>{pinnedMessages.length} Pinned</span>
                </div>
              )}

              <button
                onClick={() => {
                  setShowMembersDrawer(true);
                  loadChannelMembers();
                }}
                className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Channel members"
              >
                <Users className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Pinned Messages Banner */}
          {pinnedMessages.length > 0 && !searchQuery && (
            <div className="bg-zinc-950/90 border-b border-zinc-800/80 px-4 py-2 flex items-center gap-2 text-xs text-zinc-300 font-mono overflow-x-auto">
              <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-zinc-500">Pinned:</span>
              <span className="truncate italic text-zinc-300">
                "{pinnedMessages[pinnedMessages.length - 1]?.content}"
              </span>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {channelError ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200">Private Channel Access Denied</h3>
                <p className="text-xs text-zinc-400 max-w-sm mt-1">{channelError}</p>
                <button
                  onClick={() => setActiveChannel('general')}
                  className="mt-4 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-200"
                >
                  Return to #general
                </button>
              </div>
            ) : isLoading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-500 space-y-2">
                <div className="h-5 w-5 border-2 border-zinc-600 border-t-emerald-400 rounded-full animate-spin" />
                <span className="text-xs font-mono">Loading channel history...</span>
              </div>
            ) : displayedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3">
                  {activeChannelObj?.isPrivate ? (
                    <Lock className="h-6 w-6 text-zinc-500" />
                  ) : (
                    <Hash className="h-6 w-6 text-zinc-500" />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-zinc-200">
                  {searchResults !== null
                    ? 'No messages matched your query'
                    : `Welcome to #${activeChannelObj?.name || activeChannel}!`}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  {searchResults !== null
                    ? 'Try adjusting your search keywords.'
                    : `This is the start of #${activeChannelObj?.name || activeChannel}. Send a message to start communicating.`}
                </p>
              </div>
            ) : (
              displayedMessages.map((msg) => {
                const isMe = msg.user.id === user?.id;
                const reactions = msg.reactions || {};
                const hasReactions = Object.keys(reactions).length > 0;
                const isEditing = editingMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`group relative flex gap-3 p-2.5 rounded-lg transition-colors hover:bg-zinc-900/50 ${
                      msg.pinned ? 'border-l-2 border-amber-500/80 bg-amber-500/[0.02]' : ''
                    }`}
                  >
                    {/* User Avatar */}
                    <div className="h-8 w-8 rounded bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/60 flex items-center justify-center text-xs font-mono font-bold text-zinc-300 shrink-0">
                      {msg.user?.displayName ? msg.user.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>

                    {/* Message Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200 font-mono">
                          {msg.user?.displayName || 'User'}
                        </span>
                        {isMe && (
                          <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400">
                            YOU
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.isEdited && (
                          <span className="text-[9px] text-zinc-600 font-mono italic">(edited)</span>
                        )}
                        {msg.pinned && <Pin className="h-3 w-3 text-amber-400 ml-1" />}
                      </div>

                      {/* Replying quote if exists */}
                      {msg.replyTo && (
                        <div className="my-1.5 p-1.5 rounded bg-zinc-900/80 border-l-2 border-zinc-700 text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
                          <Reply className="h-3 w-3 text-zinc-500 shrink-0" />
                          <span className="font-semibold text-zinc-300">{msg.replyTo.user?.displayName}:</span>
                          <span className="truncate italic">{msg.replyTo.content}</span>
                        </div>
                      )}

                      {/* Content rendering or Edit Mode */}
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-100 font-sans focus:outline-none focus:border-emerald-500 resize-none"
                            rows={3}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditSubmit(msg.id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-mono font-medium"
                            >
                              Save changes
                            </button>
                            <button
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditingText('');
                              }}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-300 mt-1 leading-relaxed whitespace-pre-wrap break-words font-sans">
                          {renderFormattedContent(msg.content)}
                        </div>
                      )}

                      {/* Reactions Chips */}
                      {hasReactions && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {Object.entries(reactions).map(([emoji, users]) => {
                            const reactedByMe = users.includes(user?.id || '');
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                                  reactedByMe
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-medium'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="font-mono text-[10px]">{users.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Hover Actions Menu */}
                    <div className="absolute right-3 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-1 shadow-lg z-10">
                      {/* Emoji picker trigger */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveEmojiPickerMsgId(
                              activeEmojiPickerMsgId === msg.id ? null : msg.id
                            )
                          }
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                          title="Add reaction"
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>

                        {/* Floating Emoji Picker Popover */}
                        {activeEmojiPickerMsgId === msg.id && (
                          <div className="absolute right-0 bottom-full mb-1 flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded-lg p-1.5 shadow-2xl z-30">
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                className="p-1 text-base hover:scale-125 transition-transform"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reply Button */}
                      <button
                        onClick={() => setReplyingToMessage(msg)}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                        title="Reply to message"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>

                      {/* Copy Button */}
                      <button
                        onClick={() => handleCopyMessage(msg)}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                        title="Copy message"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {/* Edit Button (Own message) */}
                      {isMe && (
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditingText(msg.content);
                          }}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                          title="Edit message"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Pin Toggle */}
                      <button
                        onClick={() => handleTogglePin(msg.id)}
                        className={`p-1 rounded hover:bg-zinc-800 ${
                          msg.pinned ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        title={msg.pinned ? 'Unpin message' : 'Pin message'}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete */}
                      {(isMe || currentWorkspace?.role === 'OWNER' || currentWorkspace?.role === 'ADMIN') && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-rose-400"
                          title="Delete message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ─── Message Input Bar ─── */}
          <div className="p-3 border-t border-[#1a1a1a] bg-zinc-950/80">
            {/* Replying banner */}
            {replyingToMessage && (
              <div className="mb-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs text-zinc-300">
                <div className="flex items-center gap-2 truncate">
                  <Reply className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-semibold font-mono text-zinc-200">
                    Replying to {replyingToMessage.user?.displayName}:
                  </span>
                  <span className="truncate italic text-zinc-400">{replyingToMessage.content}</span>
                </div>
                <button
                  onClick={() => setReplyingToMessage(null)}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="space-y-2">
              <div className="relative rounded-lg bg-zinc-900/90 border border-zinc-800 focus-within:border-zinc-700 transition-colors p-2">
                <textarea
                  rows={2}
                  placeholder={`Message #${activeChannelObj?.name || activeChannel}... (Press Enter to send, Shift+Enter for newline)`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none font-sans"
                />

                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <button
                      type="button"
                      onClick={() => setShowCodeModal(true)}
                      className="p-1 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                      title="Insert code snippet"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[10px] text-zinc-600 font-mono">
                      Markdown: **bold**, *italic*, `code`, &gt; quote
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-mono font-medium transition-all shadow-sm"
                  >
                    <span>Send</span>
                    <Send className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* ─── Channel Members Drawer ─── */}
        {showMembersDrawer && (
          <div className="w-64 border-l border-[#1a1a1a] bg-[#0c0c0c] flex flex-col">
            <div className="p-3.5 border-b border-[#1a1a1a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-xs font-semibold tracking-wider uppercase text-zinc-200">
                  Members
                </span>
              </div>
              <button
                onClick={() => setShowMembersDrawer(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Invite Form if Private Channel */}
            {activeChannelObj?.isPrivate && (
              <div className="p-3 border-b border-zinc-800/60 space-y-2">
                <label className="text-[10px] font-mono uppercase text-zinc-400 block">
                  Add User to Channel
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="User ID..."
                    value={inviteUserId}
                    onChange={(e) => setInviteUserId(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 font-mono focus:outline-none"
                  />
                  <button
                    onClick={handleInviteMember}
                    disabled={!inviteUserId.trim()}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded text-xs font-mono"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingMembers ? (
                <div className="p-4 text-center text-xs font-mono text-zinc-500">
                  Loading members...
                </div>
              ) : channelMembers.length === 0 ? (
                <div className="p-4 text-center text-xs font-mono text-zinc-500">
                  No members found
                </div>
              ) : (
                channelMembers.map((m) => {
                  const memberUser = m.user || m;
                  const isCreator = activeChannelObj?.createdById === memberUser.id;
                  return (
                    <div
                      key={m.id || memberUser.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-zinc-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="h-6 w-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-300 shrink-0">
                          {memberUser.displayName ? memberUser.displayName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-mono text-zinc-200 truncate">
                            {memberUser.displayName}
                          </div>
                          <div className="text-[9px] font-mono text-zinc-500 truncate">
                            {m.role || (isCreator ? 'OWNER' : 'MEMBER')}
                          </div>
                        </div>
                      </div>

                      {activeChannelObj?.isPrivate && memberUser.id !== user?.id && (
                        <button
                          onClick={() => handleRemoveMember(memberUser.id)}
                          className="text-zinc-600 hover:text-rose-400 p-1"
                          title="Remove from channel"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Create Channel Modal ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-zinc-100 font-mono">Create Team Channel</h4>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createChannelError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
                {createChannelError}
              </div>
            )}

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-1">
                  Channel Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">
                    #
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. backend-sprint, qa-alerts"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="w-full pl-6 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-1">Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Daily technical updates and architecture"
                  value={newChannelTopic}
                  onChange={(e) => setNewChannelTopic(e.target.value)}
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 font-sans focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-zinc-400 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="What is this channel about?"
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 font-sans focus:outline-none focus:border-zinc-700 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <Lock className={`h-4 w-4 ${newChannelIsPrivate ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <div>
                    <div className="text-xs font-mono font-medium text-zinc-200">Private Channel</div>
                    <div className="text-[10px] text-zinc-500">Only authorized members can view and join</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={newChannelIsPrivate}
                  onChange={(e) => setNewChannelIsPrivate(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded text-xs font-mono text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim() || createChannelLoading}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-mono font-medium"
                >
                  {createChannelLoading ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Topic Modal ─── */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h4 className="text-sm font-semibold text-zinc-100 font-mono">
                Edit Channel Topic
              </h4>
              <button onClick={() => setShowTopicModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-400 block mb-1">
                Topic for #{activeChannelObj?.name || activeChannel}
              </label>
              <textarea
                rows={3}
                value={editTopicValue}
                onChange={(e) => setEditTopicValue(e.target.value)}
                placeholder="Set a topic for this channel..."
                className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 font-sans focus:outline-none focus:border-zinc-700 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowTopicModal(false)}
                className="px-3 py-1.5 rounded text-xs font-mono text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTopic}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium"
              >
                Save Topic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Code Snippet Modal ─── */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-zinc-100 font-mono">Insert Code Snippet</h4>
              </div>
              <button onClick={() => setShowCodeModal(false)} className="text-zinc-500 hover:text-zinc-300 text-xs font-mono">
                Cancel
              </button>
            </div>

            <div>
              <label className="text-xs font-mono text-zinc-400 block mb-1">Language</label>
              <select
                value={codeLanguage}
                onChange={(e) => setCodeLanguage(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none font-mono"
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="sql">SQL / Postgres</option>
                <option value="bash">Bash / Shell</option>
                <option value="json">JSON</option>
                <option value="html">HTML / JSX</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono text-zinc-400 block mb-1">Code</label>
              <textarea
                rows={6}
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                placeholder="// Paste or write code snippet here..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowCodeModal(false)}
                className="px-3 py-1.5 rounded text-xs font-mono text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertCodeSnippet}
                disabled={!codeSnippet.trim()}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium disabled:opacity-40"
              >
                Insert into Message
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
