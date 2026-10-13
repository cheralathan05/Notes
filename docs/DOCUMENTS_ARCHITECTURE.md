# KRONOS DOCUMENTS & NOTES PLATFORM — ARCHITECTURE SPECIFICATION

## 1. System Overview

The KRONOS Documents & Notes module is a production-grade, sovereign document and knowledge management system built inside the KRONOS Productivity SaaS platform. It combines a distraction-free rich-text editing canvas with hierarchical document trees, atomic versioning, robust autosave, instant search, pre-seeded and user-defined templates, file attachments, and local/remote AI acceleration.

The visual identity adheres strictly to the **KRONOS Monochrome Design Language**: `#080808` canvas, `#101010` secondary surfaces, `#151515` panels, `#2D2D2D` hairline borders, and `#FAFAFA` high-contrast typography.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          KRONOS CLIENT LAYER                           │
│  (Next.js App Router, React 19, TypeScript, Tailwind 4, TipTap Engine) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS + Session Cookies
┌───────────────────────────────────▼────────────────────────────────────┐
│                           API GATEWAY LAYER                            │
│           (Express, Rate Limiting, Helmet, Cookie Auth Middleware)      │
├────────────────────────────────────────────────────────────────────────┤
│                          BUSINESS MODULES                              │
│  • Auth & User Session Verification     • Document Revision History    │
│  • Document & Folder Hierarchical CRUD   • File Attachments & Uploads   │
│  • Optimistic Concurrency Control       • Template Engine              │
│  • Global & In-Document Search          • AI Synthesis & Q&A Assistant │
│  • Export & Import Processing Engine    • Collaboration & Permissions  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Prisma ORM
┌───────────────────────────────────▼────────────────────────────────────┐
│                          PERSISTENCE LAYER                             │
│                  PostgreSQL 16 (Relational Schema)                     │
│  • Workspaces & Memberships            • Revisions & Diffs             │
│  • Documents (JSON Content + Metadata) • Attachments & Storage Refs    │
│  • Folders & Hierarchies               • Templates & Tags              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### Frontend Layer
- **Layout Shell (`/workspace`)**:
  - `WorkspaceSidebar`: Collapsible sidebar containing workspace switcher, quick search trigger (`Cmd/Ctrl+K`), quick create, nested document tree, folders, favorites, recent documents, trash, and settings.
  - `DocumentTree`: Drag-and-drop recursive page tree supporting unlimited nesting levels, status icons, drag reordering, and context menus.
  - `DocumentCanvas`: Clean, responsive writing canvas with title editor, cover image header, icon picker, breadcrumb navigation, and save status indicator.
  - `EditorToolbar`: Sticky or floating rich-text formatting toolbar (H1-H3, bold, italic, underline, strikethrough, lists, task lists, blockquotes, code blocks, tables, callouts, alignment).
  - `SlashCommandMenu`: Contextual floating menu triggered by `/` offering instant block insertions (Headings, Tables, Checklists, Code, Callouts, AI Prompts).
  - `AiSidePanel`: Collapsible drawer for document summarization, grammar refinement, tone shifting, action item extraction, and Q&A.
  - `RevisionHistoryModal`: Slide-out panel allowing side-by-side inspection of past document versions with single-click restoration.
  - `ExportModal`: Dialog supporting multi-format generation (PDF, Markdown, HTML, Plain Text, DOCX).
  - `TemplatePicker`: Modal offering 10 pre-built templates and custom user-saved templates.

### Backend Layer
- **Controllers & Routes**:
  - `/api/documents`: Full CRUD, move, duplicate, archive, restore, trash, and permanent deletion.
  - `/api/documents/:id/revisions`: Automatic snapshot creation, diffing, and rollback.
  - `/api/documents/:id/attachments`: Validated file upload handling, download, and deletion.
  - `/api/templates`: System and user-created template management.
  - `/api/search`: Workspace-wide title and content search with tag and date filters.
  - `/api/ai/documents`: Document summaries, rewrites, action item extraction, and context-aware Q&A.
  - `/api/import-export`: Importers (MD, HTML, TXT, DOCX) and Exporters.

---

## 3. Concurrency, Autosave & Data Integrity

1. **Optimistic Concurrency Control (OCC)**:
   - Every document maintains an integer `version` field.
   - When the client initiates an update, it submits its current version. If the server detects a version mismatch (another tab or collaborator updated the document), it returns `409 CONFLICT` with the latest server state, preventing silent overwrites.
2. **Autosave Pipeline**:
   - Edits trigger local state updates immediately.
   - An intelligent debounce timer (750ms) queues updates.
   - Distinct statuses displayed to the user: `Unsaved`, `Saving...`, `Saved`, and `Sync Error` (with retry action).
3. **Automatic Revisions**:
   - On major saves or every 5 minutes during active editing, the server commits an immutable snapshot to `DocumentRevision`.
   - Users can review past revisions with author metadata and restore any historical state.
