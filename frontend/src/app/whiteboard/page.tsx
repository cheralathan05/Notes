'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppShell } from '@/components/app-shell';
import { api, CanvasItem } from '@/lib/api';
import { useWorkspace } from '@/context/workspace-context';
import {
  Layers,
  Plus,
  Save,
  Trash2,
  ArrowRight,
  StickyNote,
  Server,
  Globe,
  Database,
  Cpu,
  Cloud,
  Download,
  Upload,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Check,
  RotateCcw,
  RotateCw,
  X,
  Shield,
  ExternalLink,
  HardDrive,
  Radio,
  Box,
  Copy,
  AlertCircle,
  Link as LinkIcon,
  RefreshCw,
  Edit2,
} from 'lucide-react';

export interface DiagramNode {
  id: string;
  type: string;
  title: string;
  description?: string;
  x: number;
  y: number;
  color?: string;
  icon?: string;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramStickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';

const NODE_CATALOG = [
  { type: 'frontend', title: 'Next.js Frontend', description: 'SSR & Client App', color: '#3B82F6', icon: 'Globe' },
  { type: 'api', title: 'Express API Server', description: 'REST & WebSockets Gateway', color: '#10B981', icon: 'Server' },
  { type: 'db', title: 'PostgreSQL Database', description: 'Multi-Tenant Relational Store', color: '#8B5CF6', icon: 'Database' },
  { type: 'cache', title: 'Redis Cache', description: 'In-Memory Key/Value & PubSub', color: '#EF4444', icon: 'Cpu' },
  { type: 'queue', title: 'Kafka / Event Bus', description: 'Distributed Messaging Stream', color: '#F59E0B', icon: 'Radio' },
  { type: 'cloud', title: 'Cloud Worker / Job', description: 'Async Background Processor', color: '#06B6D4', icon: 'Cloud' },
  { type: 'auth', title: 'Auth & Identity', description: 'JWT, OAuth & Session Guard', color: '#6366F1', icon: 'Shield' },
  { type: 'storage', title: 'Object Storage / S3', description: 'Encrypted Asset Store', color: '#F97316', icon: 'HardDrive' },
  { type: 'external', title: 'External Service', description: 'Third-Party Webhooks & APIs', color: '#EC4899', icon: 'ExternalLink' },
  { type: 'generic', title: 'System Component', description: 'Generic Microservice or Module', color: '#71717A', icon: 'Box' },
];

const NOTE_COLORS = [
  { name: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-200', hex: '#F59E0B' },
  { name: 'emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-200', hex: '#10B981' },
  { name: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-200', hex: '#3B82F6' },
  { name: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-200', hex: '#8B5CF6' },
  { name: 'rose', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-200', hex: '#F43F5E' },
];

export default function WhiteboardPage() {
  const { currentWorkspace } = useWorkspace();

  // Canvas library state
  const [canvases, setCanvases] = useState<CanvasItem[]>([]);
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);
  const [canvasTitle, setCanvasTitle] = useState('Production System Architecture');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Canvas elements state
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [connections, setConnections] = useState<DiagramConnection[]>([]);
  const [notes, setNotes] = useState<DiagramStickyNote[]>([]);

  // Selection & interactive connection mode
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [selectedConnectionIndex, setSelectedConnectionIndex] = useState<number | null>(null);
  const [editingConnectionLabelIdx, setEditingConnectionLabelIdx] = useState<number | null>(null);
  const [tempConnectionLabel, setTempConnectionLabel] = useState('');

  // Viewport navigation
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // History stack for Undo / Redo
  const [history, setHistory] = useState<Array<{ nodes: DiagramNode[]; connections: DiagramConnection[]; notes: DiagramStickyNote[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Modals
  const [showCanvasesModal, setShowCanvasesModal] = useState(false);
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [canvasSearchQuery, setCanvasSearchQuery] = useState('');

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Push state to undo stack
  const recordHistory = useCallback(
    (newNodes: DiagramNode[], newConnections: DiagramConnection[], newNotes: DiagramStickyNote[]) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, { nodes: newNodes, connections: newConnections, notes: newNotes }];
      });
      setHistoryIndex((prev) => prev + 1);
      setSaveStatus('unsaved');
    },
    [historyIndex]
  );

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setNodes(prev.nodes);
      setConnections(prev.connections);
      setNotes(prev.notes);
      setHistoryIndex(historyIndex - 1);
      setSaveStatus('unsaved');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setNodes(next.nodes);
      setConnections(next.connections);
      setNotes(next.notes);
      setHistoryIndex(historyIndex + 1);
      setSaveStatus('unsaved');
    }
  };

  // ─── 1. Load Initial Canvases ──────────────────────────────────────────────
  const loadCanvasesList = async () => {
    try {
      const res = await api.listCanvases();
      if (res.success && res.data) {
        setCanvases(res.data.canvases);
        return res.data.canvases;
      }
    } catch (err) {
      console.error('Failed to load canvases:', err);
    }
    return [];
  };

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    async function init() {
      const list = await loadCanvasesList();
      if (list.length > 0 && !currentCanvasId) {
        const first = list[0];
        setCurrentCanvasId(first.id);
        setCanvasTitle(first.title);
        const data = first.data || {};
        const initNodes = data.nodes || [];
        const initConns = data.connections || [];
        const initNotes = data.notes || [];

        setNodes(initNodes);
        setConnections(initConns);
        setNotes(initNotes);
        setHistory([{ nodes: initNodes, connections: initConns, notes: initNotes }]);
        setHistoryIndex(0);
        setSaveStatus('saved');
      } else if (list.length === 0) {
        // Create initial default canvas
        const defaultCanvas = {
          title: 'Production Architecture Diagram',
          data: {
            nodes: [
              { id: 'n-fe', type: 'frontend', title: 'Next.js 16 Web Client', description: 'SSR App Router', x: 80, y: 160, color: '#3B82F6', icon: 'Globe' },
              { id: 'n-api', type: 'api', title: 'Express Monolithic Core', description: 'API Gateway on :4000', x: 420, y: 160, color: '#10B981', icon: 'Server' },
              { id: 'n-db', type: 'db', title: 'PostgreSQL Database', description: 'Relational Source of Truth', x: 760, y: 160, color: '#8B5CF6', icon: 'Database' },
            ],
            connections: [
              { from: 'n-fe', to: 'n-api', label: 'HTTP / REST' },
              { from: 'n-api', to: 'n-db', label: 'Prisma Client' },
            ],
            notes: [
              { id: 'memo-1', text: 'All modules integrated into a sovereign repository for high throughput.', x: 120, y: 360, color: '#10B981' },
            ],
          },
        };

        try {
          const res = await api.createCanvas(defaultCanvas);
          if (res.success && res.data) {
            const created = res.data.canvas;
            setCurrentCanvasId(created.id);
            setCanvasTitle(created.title);
            setNodes(created.data.nodes || []);
            setConnections(created.data.connections || []);
            setNotes(created.data.notes || []);
            setHistory([{ nodes: created.data.nodes || [], connections: created.data.connections || [], notes: created.data.notes || [] }]);
            setHistoryIndex(0);
            setSaveStatus('saved');
            await loadCanvasesList();
          }
        } catch (e) {}
      }
    }

    init();
  }, [currentWorkspace?.id]);

  // ─── 2. Real Save Operation ────────────────────────────────────────────────
  const handleSaveCanvas = async () => {
    setSaveStatus('saving');
    setSaveErrorMsg(null);

    const payload = {
      title: canvasTitle.trim() || 'Untitled Architecture Diagram',
      data: {
        nodes,
        connections,
        notes,
      },
    };

    try {
      if (currentCanvasId) {
        const res = await api.updateCanvas(currentCanvasId, payload);
        if (res.success) {
          setSaveStatus('saved');
          await loadCanvasesList();
        } else {
          setSaveStatus('failed');
          setSaveErrorMsg(res.error?.message || 'Database update rejected');
        }
      } else {
        const res = await api.createCanvas(payload);
        if (res.success && res.data) {
          setCurrentCanvasId(res.data.canvas.id);
          setSaveStatus('saved');
          await loadCanvasesList();
        } else {
          setSaveStatus('failed');
          setSaveErrorMsg(res.error?.message || 'Failed to create canvas');
        }
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      setSaveStatus('failed');
      setSaveErrorMsg(err?.message || 'Network failure while saving canvas');
    }
  };

  // ─── 3. Node Operations ────────────────────────────────────────────────────
  const handleAddNode = (catalogItem: typeof NODE_CATALOG[0]) => {
    const id = `node-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    // Position near viewport center
    const posX = Math.round(150 + Math.random() * 200 - pan.x / zoom);
    const posY = Math.round(150 + Math.random() * 150 - pan.y / zoom);

    const newNode: DiagramNode = {
      id,
      type: catalogItem.type,
      title: catalogItem.title,
      description: catalogItem.description,
      x: Math.max(20, posX),
      y: Math.max(20, posY),
      color: catalogItem.color,
      icon: catalogItem.icon,
    };

    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    recordHistory(nextNodes, connections, notes);
    setSelectedNodeId(newNode.id);
  };

  const handleDuplicateNode = (id: string) => {
    const orig = nodes.find((n) => n.id === id);
    if (!orig) return;

    const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const duplicated: DiagramNode = {
      ...orig,
      id: newId,
      title: `${orig.title} (Copy)`,
      x: orig.x + 30,
      y: orig.y + 30,
    };

    const nextNodes = [...nodes, duplicated];
    setNodes(nextNodes);
    recordHistory(nextNodes, connections, notes);
    setSelectedNodeId(newId);
  };

  const handleDeleteNode = (id: string) => {
    const nextNodes = nodes.filter((n) => n.id !== id);
    // Cleanup any connection attached to this node
    const nextConns = connections.filter((c) => c.from !== id && c.to !== id);
    setNodes(nextNodes);
    setConnections(nextConns);
    recordHistory(nextNodes, nextConns, notes);
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (connectingSourceId === id) setConnectingSourceId(null);
  };

  const handleUpdateNode = (id: string, updates: Partial<DiagramNode>) => {
    const nextNodes = nodes.map((n) => (n.id === id ? { ...n, ...updates } : n));
    setNodes(nextNodes);
    setSaveStatus('unsaved');
  };

  // ─── 4. Connection Operations ──────────────────────────────────────────────
  const handleStartConnection = (sourceId: string) => {
    setConnectingSourceId(sourceId);
  };

  const handleCompleteConnection = (targetId: string) => {
    if (!connectingSourceId || connectingSourceId === targetId) {
      setConnectingSourceId(null);
      return;
    }

    // Check if connection already exists in either direction
    const exists = connections.some(
      (c) =>
        (c.from === connectingSourceId && c.to === targetId) ||
        (c.from === targetId && c.to === connectingSourceId)
    );

    if (!exists) {
      const nextConns = [...connections, { from: connectingSourceId, to: targetId, label: 'HTTP / API Proxy' }];
      setConnections(nextConns);
      recordHistory(nodes, nextConns, notes);
    }

    setConnectingSourceId(null);
  };

  const handleDeleteConnection = (idx: number) => {
    const nextConns = connections.filter((_, i) => i !== idx);
    setConnections(nextConns);
    recordHistory(nodes, nextConns, notes);
    setSelectedConnectionIndex(null);
    setEditingConnectionLabelIdx(null);
  };

  const handleSaveConnectionLabel = (idx: number) => {
    const nextConns = connections.map((c, i) =>
      i === idx ? { ...c, label: tempConnectionLabel.trim() } : c
    );
    setConnections(nextConns);
    recordHistory(nodes, nextConns, notes);
    setEditingConnectionLabelIdx(null);
  };

  // ─── 5. Sticky Notes Operations ───────────────────────────────────────────
  const handleAddNote = () => {
    const id = `note-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const posX = Math.round(160 + Math.random() * 200 - pan.x / zoom);
    const posY = Math.round(200 + Math.random() * 150 - pan.y / zoom);

    const newNote: DiagramStickyNote = {
      id,
      text: 'New Architecture Note...\nWrite design decisions or trade-offs here.',
      x: Math.max(20, posX),
      y: Math.max(20, posY),
      color: '#F59E0B',
    };

    const nextNotes = [...notes, newNote];
    setNotes(nextNotes);
    recordHistory(nodes, connections, nextNotes);
  };

  const handleDeleteNote = (id: string) => {
    const nextNotes = notes.filter((n) => n.id !== id);
    setNotes(nextNotes);
    recordHistory(nodes, connections, nextNotes);
  };

  const handleUpdateNote = (id: string, updates: Partial<DiagramStickyNote>) => {
    const nextNotes = notes.map((n) => (n.id === id ? { ...n, ...updates } : n));
    setNotes(nextNotes);
    setSaveStatus('unsaved');
  };

  // ─── 6. Multi-Canvas Operations ───────────────────────────────────────────
  const handleCreateNewCanvas = async () => {
    const payload = {
      title: `Untitled Architecture ${canvases.length + 1}`,
      data: { nodes: [], connections: [], notes: [] },
    };

    try {
      const res = await api.createCanvas(payload);
      if (res.success && res.data) {
        const created = res.data.canvas;
        setCanvases((prev) => [created, ...prev]);
        setCurrentCanvasId(created.id);
        setCanvasTitle(created.title);
        setNodes([]);
        setConnections([]);
        setNotes([]);
        setHistory([{ nodes: [], connections: [], notes: [] }]);
        setHistoryIndex(0);
        setSaveStatus('saved');
        setShowCanvasesModal(false);
      }
    } catch (err) {
      console.error('Failed to create canvas:', err);
    }
  };

  const handleSelectCanvas = (c: CanvasItem) => {
    if (saveStatus === 'unsaved') {
      const confirmSwitch = window.confirm(
        'You have unsaved changes on the current canvas. Switch anyway?'
      );
      if (!confirmSwitch) return;
    }

    setCurrentCanvasId(c.id);
    setCanvasTitle(c.title);
    const data = c.data || {};
    const newNodes = data.nodes || [];
    const newConns = data.connections || [];
    const newNotes = data.notes || [];

    setNodes(newNodes);
    setConnections(newConns);
    setNotes(newNotes);
    setHistory([{ nodes: newNodes, connections: newConns, notes: newNotes }]);
    setHistoryIndex(0);
    setSaveStatus('saved');
    setShowCanvasesModal(false);
  };

  const handleDuplicateCanvas = async (c: CanvasItem) => {
    try {
      const res = await api.duplicateCanvas(c.id);
      if (res.success && res.data) {
        const duplicated = res.data.canvas;
        setCanvases((prev) => [duplicated, ...prev]);
        handleSelectCanvas(duplicated);
      }
    } catch (err) {
      console.error('Failed to duplicate canvas:', err);
    }
  };

  const handleDeleteCanvas = async (c: CanvasItem) => {
    if (!window.confirm(`Are you sure you want to delete canvas "${c.title}"?`)) return;

    try {
      const res = await api.deleteCanvas(c.id);
      if (res.success) {
        setCanvases((prev) => prev.filter((item) => item.id !== c.id));
        if (currentCanvasId === c.id) {
          const remaining = canvases.filter((item) => item.id !== c.id);
          if (remaining.length > 0) {
            handleSelectCanvas(remaining[0]);
          } else {
            handleCreateNewCanvas();
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete canvas:', err);
    }
  };

  // ─── 7. Blueprint Application ─────────────────────────────────────────────
  const handleApplyBlueprint = (blueprintKey: string) => {
    const blueprintData = {
      monolith: {
        title: 'Monolithic Sovereign Architecture',
        nodes: [
          { id: '1', type: 'frontend', title: 'Next.js App Router (SSR + Client)', description: 'Unified web client', x: 80, y: 140, color: '#3B82F6', icon: 'Globe' },
          { id: '2', type: 'api', title: 'Express Monolithic Core (Port 4000)', description: 'REST APIs & WebSockets', x: 420, y: 140, color: '#10B981', icon: 'Server' },
          { id: '3', type: 'db', title: 'PostgreSQL Database', description: 'Multi-tenant relational database', x: 780, y: 140, color: '#8B5CF6', icon: 'Database' },
          { id: '4', type: 'cache', title: 'Realtime SSE Hub', description: 'In-memory presence broadcasting', x: 420, y: 320, color: '#EF4444', icon: 'Cpu' },
          { id: '5', type: 'cloud', title: 'Background Mailer & Workers', description: 'SMTP and async job execution', x: 780, y: 320, color: '#F59E0B', icon: 'Cloud' },
        ],
        connections: [
          { from: '1', to: '2', label: 'HTTP / API Proxy' },
          { from: '2', to: '3', label: 'Prisma Client ORM' },
          { from: '2', to: '4', label: 'Event Streaming' },
          { from: '2', to: '5', label: 'Async Queue' },
        ],
        notes: [
          { id: 'n1', text: 'All modules integrated in one sovereign monolithic repo for zero latency and rapid feature releases.', x: 100, y: 360, color: '#10B981' }
        ]
      },
      microservices: {
        title: 'Event-Driven Microservices Architecture',
        nodes: [
          { id: 'ms-gw', type: 'api', title: 'API Gateway & Rate Limiter', description: 'Ingress traffic management', x: 80, y: 160, color: '#10B981', icon: 'Server' },
          { id: 'ms-auth', type: 'auth', title: 'Identity & Auth Service', description: 'OAuth2 & JWT Token Guard', x: 400, y: 80, color: '#6366F1', icon: 'Shield' },
          { id: 'ms-core', type: 'api', title: 'Core Workspace API', description: 'Multi-tenant workspace operations', x: 400, y: 240, color: '#3B82F6', icon: 'Server' },
          { id: 'ms-bus', type: 'queue', title: 'Kafka / Redis Event Bus', description: 'High-throughput event streaming', x: 760, y: 160, color: '#F59E0B', icon: 'Radio' },
          { id: 'ms-db', type: 'db', title: 'Postgres Tenant DBs', description: 'Isolated tenant stores', x: 760, y: 340, color: '#8B5CF6', icon: 'Database' },
        ],
        connections: [
          { from: 'ms-gw', to: 'ms-auth', label: 'Token Verification' },
          { from: 'ms-gw', to: 'ms-core', label: 'gRPC Call' },
          { from: 'ms-core', to: 'ms-bus', label: 'Publish Events' },
          { from: 'ms-core', to: 'ms-db', label: 'SQL Read/Write' },
        ],
        notes: [
          { id: 'n-ms', text: 'Decoupled domain services communicating asynchronously via durable message logs.', x: 100, y: 360, color: '#3B82F6' }
        ]
      },
      ai_pipeline: {
        title: 'Modern AI / LLM Streaming Pipeline',
        nodes: [
          { id: 'ai-client', type: 'frontend', title: 'Agent Workspace UI', description: 'Prompt studio & token stream', x: 80, y: 160, color: '#3B82F6', icon: 'Globe' },
          { id: 'ai-orch', type: 'api', title: 'Agent Orchestrator', description: 'Tool calling & AST execution', x: 420, y: 160, color: '#10B981', icon: 'Server' },
          { id: 'ai-vec', type: 'db', title: 'pgvector Embeddings', description: 'Semantic similarity index', x: 780, y: 90, color: '#8B5CF6', icon: 'Database' },
          { id: 'ai-llm', type: 'external', title: 'Anthropic / LLM Cluster', description: 'Multi-modal inference API', x: 780, y: 260, color: '#EC4899', icon: 'Cpu' },
        ],
        connections: [
          { from: 'ai-client', to: 'ai-orch', label: 'SSE Stream' },
          { from: 'ai-orch', to: 'ai-vec', label: 'Vector Similarity' },
          { from: 'ai-orch', to: 'ai-llm', label: 'Inference Stream' },
        ],
        notes: [
          { id: 'n-ai', text: 'RAG context injection with hybrid full-text and vector cosine distance lookup.', x: 120, y: 360, color: '#8B5CF6' }
        ]
      }
    };

    const bp = (blueprintData as any)[blueprintKey];
    if (bp) {
      setCanvasTitle(bp.title);
      setNodes(bp.nodes);
      setConnections(bp.connections);
      setNotes(bp.notes);
      recordHistory(bp.nodes, bp.connections, bp.notes);
      setShowBlueprintModal(false);
    }
  };

  // ─── 8. Export & Import ────────────────────────────────────────────────────
  const handleExportJSON = () => {
    const payload = {
      schemaVersion: 'kronos.canvas.v1',
      title: canvasTitle,
      exportedAt: new Date().toISOString(),
      nodes,
      connections,
      notes,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${canvasTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_architecture.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportSVG = () => {
    const svgEl = canvasRef.current?.querySelector('svg');
    if (!svgEl) return;

    // Create a standalone SVG representation with nodes and notes rendered
    const width = 1600;
    const height = 1200;
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background-color: #0c0c0c; font-family: monospace;">`;
    svgContent += `<style>
      .node-box { rx: 12px; stroke-width: 1.5; }
      .text-title { fill: #f4f4f5; font-size: 13px; font-weight: bold; }
      .text-desc { fill: #a1a1aa; font-size: 11px; }
      .conn-line { stroke: #52525b; stroke-width: 2; stroke-dasharray: 4,4; }
      .conn-label { fill: #10b981; font-size: 11px; text-anchor: middle; }
      .note-box { rx: 8px; fill: #18181b; stroke: #f59e0b; stroke-width: 1; }
      .note-text { fill: #fef3c7; font-size: 11px; }
    </style>`;

    // Render connections
    connections.forEach((c) => {
      const fromNode = nodes.find((n) => n.id === c.from);
      const toNode = nodes.find((n) => n.id === c.to);
      if (fromNode && toNode) {
        const x1 = fromNode.x + 110;
        const y1 = fromNode.y + 40;
        const x2 = toNode.x + 110;
        const y2 = toNode.y + 40;
        svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="conn-line" />`;
        if (c.label) {
          svgContent += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" class="conn-label">${c.label}</text>`;
        }
      }
    });

    // Render nodes
    nodes.forEach((n) => {
      svgContent += `<g transform="translate(${n.x}, ${n.y})">`;
      svgContent += `<rect width="220" height="85" fill="#18181b" stroke="${n.color || '#3B82F6'}" class="node-box" />`;
      svgContent += `<text x="16" y="32" class="text-title">${n.title}</text>`;
      svgContent += `<text x="16" y="55" class="text-desc">${n.description || n.type}</text>`;
      svgContent += `</g>`;
    });

    // Render notes
    notes.forEach((note) => {
      svgContent += `<g transform="translate(${note.x}, ${note.y})">`;
      svgContent += `<rect width="220" height="75" class="note-box" />`;
      svgContent += `<text x="12" y="28" class="note-text">${note.text.split('\n')[0] || ''}</text>`;
      svgContent += `</g>`;
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${canvasTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_diagram.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== 'object') {
          alert('Invalid architecture JSON format.');
          return;
        }

        const newNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
        const newConns = Array.isArray(parsed.connections) ? parsed.connections : [];
        const newNotes = Array.isArray(parsed.notes) ? parsed.notes : [];

        if (parsed.title) setCanvasTitle(parsed.title);
        setNodes(newNodes);
        setConnections(newConns);
        setNotes(newNotes);
        recordHistory(newNodes, newConns, newNotes);
      } catch (err) {
        alert('Failed to parse architecture JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ─── 9. Viewport Navigation (Fit to Screen, Reset) ─────────────────────────
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToScreen = () => {
    if (nodes.length === 0) {
      handleResetZoom();
      return;
    }

    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x + 220));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y + 100));

    const contentWidth = maxX - minX + 100;
    const contentHeight = maxY - minY + 100;

    const viewportWidth = window.innerWidth - 300;
    const viewportHeight = window.innerHeight - 150;

    const scaleX = viewportWidth / contentWidth;
    const scaleY = viewportHeight / contentHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.5), 1.2);

    setZoom(newZoom);
    setPan({
      x: Math.round((viewportWidth - contentWidth * newZoom) / 2 - minX * newZoom + 50),
      y: Math.round((viewportHeight - contentHeight * newZoom) / 2 - minY * newZoom + 50),
    });
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Globe': return <Globe className="h-4 w-4" />;
      case 'Server': return <Server className="h-4 w-4" />;
      case 'Database': return <Database className="h-4 w-4" />;
      case 'Cpu': return <Cpu className="h-4 w-4" />;
      case 'Radio': return <Radio className="h-4 w-4" />;
      case 'Cloud': return <Cloud className="h-4 w-4" />;
      case 'Shield': return <Shield className="h-4 w-4" />;
      case 'HardDrive': return <HardDrive className="h-4 w-4" />;
      case 'ExternalLink': return <ExternalLink className="h-4 w-4" />;
      default: return <Box className="h-4 w-4" />;
    }
  };

  const filteredCanvases = canvases.filter((c) =>
    c.title.toLowerCase().includes(canvasSearchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-[#080808] text-zinc-100 font-sans select-none">
        {/* ─── Top Control Bar ─── */}
        <div className="h-14 shrink-0 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md z-30">
          {/* Left Title & Save Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              <input
                type="text"
                value={canvasTitle}
                onChange={(e) => {
                  setCanvasTitle(e.target.value);
                  setSaveStatus('unsaved');
                }}
                className="bg-transparent border border-transparent hover:border-zinc-800 focus:border-zinc-700 rounded px-2 py-1 text-sm font-mono font-semibold text-zinc-100 focus:outline-none w-64 sm:w-80"
                placeholder="Canvas Title..."
              />
            </div>

            {/* Real Save State Indicator */}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Unsaved changes
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" /> Saving...
              </span>
            )}
            {saveStatus === 'failed' && (
              <button
                onClick={handleSaveCanvas}
                className="flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded hover:bg-rose-500/20"
                title={saveErrorMsg || 'Click to retry'}
              >
                <AlertCircle className="h-3 w-3" /> Save failed (Retry)
              </button>
            )}
          </div>

          {/* Right Tools & Actions */}
          <div className="flex items-center gap-2">
            {/* Undo / Redo */}
            <div className="hidden md:flex items-center bg-zinc-900 border border-zinc-800 rounded px-1">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                title="Undo"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                title="Redo"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Blueprint Templates Trigger */}
            <button
              onClick={() => setShowBlueprintModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-colors"
              title="Apply Architecture Blueprint"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Blueprint</span>
            </button>

            {/* Canvases Selector */}
            <button
              onClick={() => setShowCanvasesModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5 text-emerald-400" />
              <span>Canvases ({canvases.length})</span>
            </button>

            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded px-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
                className="p-1 text-zinc-400 hover:text-zinc-200"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="text-[10px] font-mono px-1.5 text-zinc-300 hover:text-white"
                title="Reset Zoom to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(1))))}
                className="p-1 text-zinc-400 hover:text-zinc-200"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleFitToScreen}
                className="p-1 text-zinc-400 hover:text-zinc-200 border-l border-zinc-800 ml-1 pl-1.5"
                title="Fit to Screen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Export & Import */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded">
              <button
                onClick={handleExportJSON}
                className="p-1.5 text-zinc-400 hover:text-white"
                title="Export Architecture JSON"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleExportSVG}
                className="p-1.5 text-zinc-400 hover:text-white border-l border-zinc-800"
                title="Export Diagram as SVG Vector"
              >
                <Box className="h-3.5 w-3.5" />
              </button>
              <label
                className="p-1.5 text-zinc-400 hover:text-white border-l border-zinc-800 cursor-pointer"
                title="Import Architecture JSON"
              >
                <Upload className="h-3.5 w-3.5" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveCanvas}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium transition-all shadow-sm disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saveStatus === 'saving' ? 'Saving...' : 'Save Canvas'}</span>
            </button>
          </div>
        </div>

        {/* ─── Main Editor Viewport ─── */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-[#0a0a0a]"
          onMouseDown={(e) => {
            // Check if clicking directly on canvas background for panning
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
              setIsPanning(true);
              setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              setSelectedNodeId(null);
              setConnectingSourceId(null);
            }
          }}
          onMouseMove={(e) => {
            if (isPanning) {
              setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y,
              });
            }
          }}
          onMouseUp={() => setIsPanning(false)}
        >
          {/* Subtle Architecture Grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage: 'radial-gradient(circle, #383838 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              transform: `translate(${pan.x % 24}px, ${pan.y % 24}px)`,
            }}
          />

          {/* Left Element Palette */}
          <div className="absolute left-4 top-4 z-20 flex flex-col gap-2 bg-zinc-950/95 border border-zinc-800/80 rounded-xl p-2.5 shadow-2xl backdrop-blur-md w-52">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                Node Library
              </span>
              <span className="text-[10px] font-mono text-zinc-600">{NODE_CATALOG.length}</span>
            </div>

            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
              {NODE_CATALOG.map((cat) => (
                <button
                  key={cat.type}
                  onClick={() => handleAddNode(cat)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-left group"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="truncate">{cat.title}</span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-800/80">
              <button
                onClick={handleAddNote}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono text-amber-300 hover:bg-amber-500/10 transition-colors text-left"
              >
                <StickyNote className="h-3.5 w-3.5 text-amber-400" />
                <span>+ Sticky Note</span>
              </button>
            </div>
          </div>

          {/* Connecting Mode Banner */}
          {connectingSourceId && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 bg-zinc-900 border border-emerald-500/40 rounded-full shadow-2xl text-xs font-mono text-emerald-300 animate-pulse">
              <LinkIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span>Click any target node to create a connection line</span>
              <button
                onClick={() => setConnectingSourceId(null)}
                className="text-zinc-500 hover:text-zinc-300 ml-2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Scalable & Pannable Viewport */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* SVG Interactive Connections */}
            <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-0">
              <defs>
                <marker
                  id="canvas-arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#71717A" />
                </marker>
                <marker
                  id="canvas-arrow-active"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#10B981" />
                </marker>
              </defs>

              {connections.map((c, i) => {
                const fromNode = nodes.find((n) => n.id === c.from);
                const toNode = nodes.find((n) => n.id === c.to);
                if (!fromNode || !toNode) return null;

                const startX = fromNode.x + 110;
                const startY = fromNode.y + 42;
                const endX = toNode.x + 110;
                const endY = toNode.y + 42;
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;

                const isSelectedConn = selectedConnectionIndex === i;

                return (
                  <g key={`${c.from}-${c.to}-${i}`} className="pointer-events-auto">
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke={isSelectedConn ? '#10B981' : '#3F3F46'}
                      strokeWidth={isSelectedConn ? '2.5' : '1.8'}
                      strokeDasharray="4 4"
                      markerEnd={isSelectedConn ? 'url(#canvas-arrow-active)' : 'url(#canvas-arrow)'}
                      className="cursor-pointer hover:stroke-zinc-300 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConnectionIndex(i);
                        setEditingConnectionLabelIdx(i);
                        setTempConnectionLabel(c.label || '');
                      }}
                    />
                    {c.label && (
                      <g
                        transform={`translate(${midX}, ${midY})`}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConnectionIndex(i);
                          setEditingConnectionLabelIdx(i);
                          setTempConnectionLabel(c.label || '');
                        }}
                      >
                        <rect
                          x={-(c.label.length * 3.6 + 8)}
                          y="-10"
                          width={c.label.length * 7.2 + 16}
                          height="20"
                          rx="4"
                          fill="#09090b"
                          stroke={isSelectedConn ? '#10B981' : '#27272a'}
                          strokeWidth="1"
                        />
                        <text
                          x="0"
                          y="4"
                          fill={isSelectedConn ? '#34d399' : '#A1A1AA'}
                          fontSize="10"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {c.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Empty State Banner */}
            {nodes.length === 0 && notes.length === 0 && (
              <div className="absolute left-64 top-48 flex flex-col items-center justify-center p-8 bg-zinc-950/80 border border-zinc-800 rounded-2xl max-w-md text-center shadow-2xl">
                <Layers className="h-10 w-10 text-emerald-400 mb-3" />
                <h3 className="text-sm font-semibold text-zinc-100 font-mono">
                  Architecture Canvas Empty
                </h3>
                <p className="text-xs text-zinc-400 mt-1 mb-4 leading-relaxed">
                  Start mapping your distributed systems by selecting a component from the left palette, or insert a production blueprint.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddNode(NODE_CATALOG[0])}
                    className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 hover:text-white"
                  >
                    + Add Frontend Node
                  </button>
                  <button
                    onClick={() => setShowBlueprintModal(true)}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-mono text-white font-medium"
                  >
                    ✨ Choose Blueprint
                  </button>
                </div>
              </div>
            )}

            {/* Render Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isConnectingSource = connectingSourceId === node.id;

              return (
                <div
                  key={node.id}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    borderColor: isSelected ? '#10B981' : isConnectingSource ? '#F59E0B' : node.color || '#27272a',
                  }}
                  className={`absolute z-10 w-56 rounded-xl bg-zinc-950/95 border shadow-2xl p-3 select-none cursor-move transition-shadow ${
                    isSelected ? 'ring-2 ring-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.15)]' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (connectingSourceId) {
                      handleCompleteConnection(node.id);
                    } else {
                      setSelectedNodeId(node.id);
                    }
                  }}
                  onMouseDown={(e) => {
                    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const origX = node.x;
                    const origY = node.y;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const dx = (moveEvent.clientX - startX) / zoom;
                      const dy = (moveEvent.clientY - startY) / zoom;
                      handleUpdateNode(node.id, {
                        x: Math.max(0, Math.round(origX + dx)),
                        y: Math.max(0, Math.round(origY + dy)),
                      });
                    };

                    const handleMouseUp = () => {
                      window.removeEventListener('mousemove', handleMouseMove);
                      window.removeEventListener('mouseup', handleMouseUp);
                      recordHistory(nodes, connections, notes);
                    };

                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  {/* Node Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: node.color || '#3B82F6' }}>
                        {renderIcon(node.icon || 'Globe')}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                        {node.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Connect Tool */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartConnection(node.id);
                        }}
                        className={`p-1 rounded hover:bg-zinc-800 ${
                          isConnectingSource ? 'text-amber-400' : 'text-zinc-500 hover:text-emerald-400'
                        }`}
                        title="Connect to another node"
                      >
                        <LinkIcon className="h-3 w-3" />
                      </button>

                      {/* Duplicate Node */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateNode(node.id);
                        }}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                        title="Duplicate node"
                      >
                        <Copy className="h-3 w-3" />
                      </button>

                      {/* Delete Node */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400"
                        title="Delete node"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Node Title & Description */}
                  <div className="pt-2 space-y-1">
                    <input
                      type="text"
                      value={node.title}
                      onChange={(e) => handleUpdateNode(node.id, { title: e.target.value })}
                      className="w-full bg-transparent text-xs font-mono font-semibold text-zinc-100 focus:outline-none border-b border-transparent focus:border-zinc-700"
                    />
                    <input
                      type="text"
                      placeholder="Add description..."
                      value={node.description || ''}
                      onChange={(e) => handleUpdateNode(node.id, { description: e.target.value })}
                      className="w-full bg-transparent text-[10px] font-mono text-zinc-400 focus:outline-none placeholder-zinc-600"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-900 text-[9px] font-mono text-zinc-500">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Online</span>
                    </span>
                    <span className="text-zinc-600">ID: {node.id.slice(-4)}</span>
                  </div>
                </div>
              );
            })}

            {/* Render Sticky Notes */}
            {notes.map((note) => (
              <div
                key={note.id}
                style={{
                  left: `${note.x}px`,
                  top: `${note.y}px`,
                }}
                className="absolute z-10 w-64 rounded-xl bg-zinc-950/95 border border-amber-500/40 p-3 shadow-2xl cursor-move backdrop-blur-md"
                onMouseDown={(e) => {
                  if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'BUTTON') return;
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const origX = note.x;
                  const origY = note.y;

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const dx = (moveEvent.clientX - startX) / zoom;
                    const dy = (moveEvent.clientY - startY) / zoom;
                    handleUpdateNote(note.id, {
                      x: Math.max(0, Math.round(origX + dx)),
                      y: Math.max(0, Math.round(origY + dy)),
                    });
                  };

                  const handleMouseUp = () => {
                    window.removeEventListener('mousemove', handleMouseMove);
                    window.removeEventListener('mouseup', handleMouseUp);
                    recordHistory(nodes, connections, notes);
                  };

                  window.addEventListener('mousemove', handleMouseMove);
                  window.addEventListener('mouseup', handleMouseUp);
                }}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
                  <div className="flex items-center gap-1.5">
                    <StickyNote className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] font-mono text-amber-300 font-semibold uppercase">
                      Architecture Memo
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                    className="text-zinc-600 hover:text-rose-400 p-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={note.text}
                  onChange={(e) => handleUpdateNote(note.id, { text: e.target.value })}
                  className="w-full bg-transparent text-xs text-amber-100/90 focus:outline-none resize-none font-sans pt-2 leading-relaxed placeholder-zinc-600"
                  placeholder="Type note content here..."
                />
              </div>
            ))}
          </div>

          {/* Connection Label Editor Popover */}
          {editingConnectionLabelIdx !== null && connections[editingConnectionLabelIdx] && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl">
              <span className="text-xs font-mono text-zinc-400 pl-1">Protocol:</span>
              <input
                type="text"
                value={tempConnectionLabel}
                onChange={(e) => setTempConnectionLabel(e.target.value)}
                placeholder="e.g. HTTP / REST, gRPC, WebSocket"
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none w-52"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveConnectionLabel(editingConnectionLabelIdx);
                }}
              />
              <button
                onClick={() => handleSaveConnectionLabel(editingConnectionLabelIdx)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-mono"
              >
                Save
              </button>
              <button
                onClick={() => handleDeleteConnection(editingConnectionLabelIdx)}
                className="p-1 text-zinc-500 hover:text-rose-400"
                title="Delete Connection"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setEditingConnectionLabelIdx(null)}
                className="p-1 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ─── Canvases Library Modal ─── */}
        {showCanvasesModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-zinc-100 font-mono">
                    Workspace Architecture Canvases
                  </h4>
                </div>
                <button
                  onClick={() => setShowCanvasesModal(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Action & Search */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Filter canvases..."
                  value={canvasSearchQuery}
                  onChange={(e) => setCanvasSearchQuery(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
                <button
                  onClick={handleCreateNewCanvas}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Canvas</span>
                </button>
              </div>

              {/* Canvases List */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {filteredCanvases.length === 0 ? (
                  <div className="text-xs font-mono text-zinc-500 p-6 text-center">
                    No canvases matched your query.
                  </div>
                ) : (
                  filteredCanvases.map((c) => {
                    const isCurrent = c.id === currentCanvasId;
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isCurrent
                            ? 'bg-zinc-900 border-emerald-500/40 text-white'
                            : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <button
                          onClick={() => handleSelectCanvas(c)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-200 font-mono truncate">
                              {c.title}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            By {c.user?.displayName || 'User'} • Updated {new Date(c.updatedAt).toLocaleDateString()}
                          </div>
                        </button>

                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => handleDuplicateCanvas(c)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                            title="Duplicate Canvas"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCanvas(c)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400"
                            title="Delete Canvas"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Blueprint Templates Modal ─── */}
        {showBlueprintModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h4 className="text-sm font-semibold text-zinc-100 font-mono">
                    Architecture Blueprints
                  </h4>
                </div>
                <button
                  onClick={() => setShowBlueprintModal(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {/* 1. Monolith */}
                <div className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-colors flex items-center justify-between">
                  <div className="space-y-1 max-w-sm">
                    <div className="text-xs font-semibold text-zinc-200 font-mono">
                      1. Monolithic Sovereign Architecture
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Next.js 16 Web Client, Express Core, PostgreSQL DB, Realtime SSE Hub & Mailer Job.
                    </div>
                  </div>
                  <button
                    onClick={() => handleApplyBlueprint('monolith')}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium"
                  >
                    Insert Blueprint
                  </button>
                </div>

                {/* 2. Microservices */}
                <div className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-colors flex items-center justify-between">
                  <div className="space-y-1 max-w-sm">
                    <div className="text-xs font-semibold text-zinc-200 font-mono">
                      2. Event-Driven Microservices
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      API Gateway, Auth Identity, Core Workspace Service, Kafka Bus, Sharded DBs.
                    </div>
                  </div>
                  <button
                    onClick={() => handleApplyBlueprint('microservices')}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium"
                  >
                    Insert Blueprint
                  </button>
                </div>

                {/* 3. AI Pipeline */}
                <div className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-colors flex items-center justify-between">
                  <div className="space-y-1 max-w-sm">
                    <div className="text-xs font-semibold text-zinc-200 font-mono">
                      3. Modern AI / LLM Streaming Pipeline
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Prompt Studio Client, Agent Orchestrator, pgvector Embeddings, LLM Cluster.
                    </div>
                  </div>
                  <button
                    onClick={() => handleApplyBlueprint('ai_pipeline')}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium"
                  >
                    Insert Blueprint
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
