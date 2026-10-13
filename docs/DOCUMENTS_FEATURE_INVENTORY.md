# KRONOS DOCUMENTS & NOTES — COMPLETE FEATURE INVENTORY (152 ITEMS)

| # | Feature Name | Category | Scope & Implementation Contract |
|---|---|---|---|
| 1 | Create, edit, rename, delete documents | A. Rich-text editor | Real DB persistence, optimistic UI updates, delete confirmation dialog. |
| 2 | Rich-text formatting toolbar | A. Rich-text editor | Sticky/floating toolbar with bold, italic, headings, lists, tables, code. |
| 3 | Headings H1, H2, and H3 | A. Rich-text editor | Semantic typography tokens, automatic heading anchor IDs. |
| 4 | Bold, italic, underline, strikethrough | A. Rich-text editor | TipTap marks with keyboard shortcut integration (`Ctrl+B`, `Ctrl+I`, etc.). |
| 5 | Text alignment: left, center, right, justify | A. Rich-text editor | Text-align extension with responsive preservation in exports. |
| 6 | Bulleted and numbered lists | A. Rich-text editor | Indentation support, nested lists, clean markdown serialization. |
| 7 | Checklists and task lists | A. Rich-text editor | Interactive checkboxes that toggle completion status and persist. |
| 8 | Blockquotes | A. Rich-text editor | Editorial monochrome callout styling with left hairline border. |
| 9 | Inline code and syntax-highlighted code blocks | A. Rich-text editor | Monospace font, language selector, copy-code button, syntax highlighting. |
| 10 | Hyperlinks with editing and preview | A. Rich-text editor | Popover link editor with external link indicator and URL validation. |
| 11 | Tables with row and column controls | A. Rich-text editor | Interactive tables with insert/delete row/column and header toggle. |
| 12 | Images with resize and alignment | A. Rich-text editor | Resizable image nodes with left/center/right alignment controls. |
| 13 | File attachments and previews | A. Rich-text editor | File pill preview with download link and file metadata badges. |
| 14 | Slash-command menu | A. Rich-text editor | Floating popup triggered by `/` with keyboard navigation and quick filters. |
| 15 | Drag-and-drop content blocks | A. Rich-text editor | Drag handles on content blocks for visual reordering. |
| 16 | Undo and redo | A. Rich-text editor | History stack with toolbar buttons and standard keyboard shortcuts. |
| 17 | Keyboard shortcuts | A. Rich-text editor | `Ctrl+S`, `Ctrl+Z`, `Ctrl+Y`, `Ctrl+B`, `Ctrl+I`, `Ctrl+K`, `/` shortcuts. |
| 18 | Word and character counts | A. Rich-text editor | Live counter in document footer tracking words, characters, and reading time. |
| 19 | Find and replace within document | A. Rich-text editor | Floating search overlay with match count, next/prev, and replace all. |
| 20 | Full-screen and distraction-free writing | A. Rich-text editor | Toggle hiding sidebar, headers, and toolbars for deep focus. |
| 21 | Nested pages and subpages | B. Organization | Parent-child document hierarchy in database and sidebar tree. |
| 22 | Folders and subfolders | B. Organization | Organizational folder containers for grouping related documents. |
| 23 | Drag-and-drop page ordering | B. Organization | Reorder documents within trees and move between parent folders. |
| 24 | Move and copy documents | B. Organization | Context menu actions to relocate or duplicate documents. |
| 25 | Favorites and pinned documents | B. Organization | Star action with dedicated Quick Access favorites section. |
| 26 | Recent documents | B. Organization | Track recently opened and modified documents per user. |
| 27 | Archive and restore | B. Organization | Move documents to read-only archive status and unarchive anytime. |
| 28 | Trash and permanent deletion | B. Organization | Two-stage soft deletion with 30-day retention and permanent purge. |
| 29 | Document tags and labels | B. Organization | Colorless/monochrome tag badges with tag-based filtering. |
| 30 | Breadcrumb navigation | B. Organization | Clickable path hierarchy (Workspace > Folder > Parent > Document). |
| 31 | Document duplication | B. Organization | One-click cloning of document content, title ("Copy of..."), and structure. |
| 32 | Bulk actions | B. Organization | Multi-select mode for bulk move, bulk tag, bulk archive, and bulk delete. |
| 33 | Sort by title, creation date, modification date | B. Organization | Sorting controls in document library and folder lists. |
| 34 | Filter by tags, owner, and document type | B. Organization | Multi-faceted filter dropdowns in document library. |
| 35 | Document status: draft, published, archived | B. Organization | Status enum with visual monochrome badge indicator. |
| 36 | Automatic saving while editing | C. Autosave & History | Debounced background synchronization triggered on input. |
| 37 | Save status indicators | C. Autosave & History | Honest status badges: `Unsaved`, `Saving...`, `Saved`, `Sync Error`. |
| 38 | Debounced saves | C. Autosave & History | 750ms debouncing to minimize redundant API payload calls. |
| 39 | Retry failed saves | C. Autosave & History | Manual and automatic exponential retry on network disruption. |
| 40 | Unsaved-change recovery | C. Autosave & History | Local storage cache recovery if browser closes before server sync. |
| 41 | Manual save option | C. Autosave & History | `Ctrl+S` / `Cmd+S` forces immediate server persistence. |
| 42 | Document revision history | C. Autosave & History | Immutable historical snapshots stored in PostgreSQL. |
| 43 | Revision timestamps and author metadata | C. Autosave & History | Each revision tracks creator ID, display name, timestamp, and version. |
| 44 | Compare previous and current revisions | C. Autosave & History | Revision viewer showing historical state alongside current content. |
| 45 | Restore an earlier version | C. Autosave & History | Rollback action creating a new version with the restored content. |
| 46 | Concurrency protection | C. Autosave & History | Optimistic Concurrency Control (OCC) via version numbers. |
| 47 | Conflict detection and recovery | C. Autosave & History | 409 Conflict prompts user to review server version vs local version. |
| 48 | Creation and modification metadata | C. Autosave & History | Author initials, created date, and last modified timestamps. |
| 49 | Blank document template | D. Templates | Clean slate for open-ended writing. |
| 50 | Meeting notes template | D. Templates | Attendees, agenda items, discussion notes, action checklist. |
| 51 | Project plan template | D. Templates | Objectives, milestones, timeline, risk matrix, owner assignments. |
| 52 | Daily journal template | D. Templates | Morning intentions, daily highlights, learnings, evening reflections. |
| 53 | Research notes template | D. Templates | Abstract, source links, core findings, citations, open questions. |
| 54 | Study notes template | D. Templates | Key concepts, summary, Cornell-style cues, review questions. |
| 55 | Brainstorming template | D. Templates | Problem statement, wild ideas, categorized solutions, vote ranking. |
| 56 | Technical documentation template | D. Templates | Architecture overview, API endpoints, schema, deployment steps. |
| 57 | Weekly review template | D. Templates | Achievements, blocked items, KPI progress, next week priorities. |
| 58 | Custom user-created templates | D. Templates | Save any document as a reusable workspace template. |
| 59 | Template categories and search | D. Templates | Filter templates by Product, Engineering, Personal, Planning. |
| 60 | Duplicate template into new document | D. Templates | Instant document creation pre-populated with template blocks. |
| 61 | Save document as template | D. Templates | Save current document content and structure into template library. |
| 62 | Export to PDF | E. Import & Export | Formatted printable PDF generation with preserved typography. |
| 63 | Export to Markdown | E. Import & Export | Standard CommonMark export with frontmatter title and tags. |
| 64 | Export to HTML | E. Import & Export | Self-contained HTML export with embedded styling. |
| 65 | Export to plain text | E. Import & Export | Clean ASCII/UTF-8 stripped text export. |
| 66 | Export to DOCX | E. Import & Export | Word document export with preserved headings and lists. |
| 67 | Import Markdown files | E. Import & Export | Parse `.md` files into rich editor blocks. |
| 68 | Import plain text files | E. Import & Export | Import `.txt` files into formatted paragraphs. |
| 69 | Import HTML files | E. Import & Export | Sanitize and convert HTML markup into editor nodes. |
| 70 | Import DOCX documents | E. Import & Export | Parse and extract structured text from DOCX files. |
| 71 | Import images and supported attachments | E. Import & Export | Upload referenced media into attachment storage. |
| 72 | Bulk document export | E. Import & Export | Download entire workspace or folder as a ZIP archive. |
| 73 | Formatting preservation | E. Import & Export | Ensure tables, code blocks, lists, and links convert accurately. |
| 74 | Import error reporting | E. Import & Export | User-facing report detailing unsupported formatting or parse errors. |
| 75 | Image upload | F. Images & Files | Upload JPEG, PNG, WebP, SVG, and GIF directly. |
| 76 | Paste images from clipboard | F. Images & Files | Intercept clipboard paste event and upload image file. |
| 77 | Drag and drop files into editor | F. Images & Files | Dropzone handler uploading files and inserting image/attachment blocks. |
| 78 | Resize and align images | F. Images & Files | Width adjustment handles and alignment options. |
| 79 | Image captions and alt text | F. Images & Files | Accessible image metadata fields. |
| 80 | File previews | F. Images & Files | Inline previews for PDF, text, and image attachments. |
| 81 | Download and remove attachments | F. Images & Files | Secure download links and deletion actions. |
| 82 | File type and size validation | F. Images & Files | Server-side validation enforcing file type allowlists and max sizes. |
| 83 | Storage integration | F. Images & Files | Local server disk / S3-compatible storage driver abstraction. |
| 84 | Server-side attachment permissions | F. Images & Files | Verification of workspace membership before serving attachments. |
| 85 | Detect missing or unavailable files | F. Images & Files | Graceful fallback UI for missing media. |
| 86 | Search document titles | G. Search & Nav | Rapid indexed title autocomplete search. |
| 87 | Search document content | G. Search & Nav | PostgreSQL text search across document bodies. |
| 88 | Search result filters | G. Search & Nav | Filter results by folder, tag, modification date, and author. |
| 89 | Search within current document | G. Search & Nav | In-editor search and highlight matching terms. |
| 90 | Global workspace search | G. Search & Nav | Workspace-wide modal search indexing all accessible documents. |
| 91 | Recent and frequently accessed documents | G. Search & Nav | Quick navigation history tracking. |
| 92 | Keyboard-accessible command palette | G. Search & Nav | `Cmd+K` / `Ctrl+K` unified command palette. |
| 93 | Quick document creation | G. Search & Nav | `Cmd+N` / `Ctrl+N` or single-click new document trigger. |
| 94 | Back and forward navigation | G. Search & Nav | Synchronized browser history integration. |
| 95 | Jump to headings and sections | G. Search & Nav | Clickable heading anchors. |
| 96 | Automatic table of contents | G. Search & Nav | Dynamic outline generated from H1, H2, and H3 headings. |
| 97 | Summarize document | H. AI Assistant | AI-generated executive summary of document contents. |
| 98 | Rewrite selected text | H. AI Assistant | Contextual rewriting to improve clarity and structure. |
| 99 | Improve grammar and clarity | H. AI Assistant | Proofreading assistant highlighting improvements. |
| 100 | Change tone and writing style | H. AI Assistant | Convert text to Professional, Concise, Technical, or Casual tone. |
| 101 | Continue writing from selection | H. AI Assistant | Predictive writing continuing thoughts and arguments. |
| 102 | Generate headings and outlines | H. AI Assistant | Structure unformatted notes into organized sections. |
| 103 | Generate meeting summaries | H. AI Assistant | Transform raw meeting transcripts into structured notes. |
| 104 | Extract action items from notes | H. AI Assistant | Identify tasks and generate checklist items. |
| 105 | Turn notes into tasks | H. AI Assistant | Create actionable todo items from prose. |
| 106 | Translate selected text | H. AI Assistant | Multi-language translation module. |
| 107 | Explain complex text | H. AI Assistant | Simplification engine explaining complex jargon. |
| 108 | Ask questions about current document | H. AI Assistant | In-context document Q&A assistant. |
| 109 | Ask questions across workspace | H. AI Assistant | Cross-document retrieval answering workspace questions. |
| 110 | Generate first draft from prompt | H. AI Assistant | Create full structured draft from a high-level prompt. |
| 111 | Generate templates with AI | H. AI Assistant | Create custom template blueprints on demand. |
| 112 | Stream AI responses & allow cancellation | H. AI Assistant | Real-time SSE streaming with instant abort button. |
| 113 | Accept, reject, regenerate AI suggestions | H. AI Assistant | Diff review card to insert, replace, or re-run AI output. |
| 114 | Track AI request failures & limits | H. AI Assistant | Rate limit tracking, failure feedback, and operational logging. |
| 115 | Share documents with members | I. Collaboration | Share with specific workspace members with permission levels. |
| 116 | View and edit permissions | I. Collaboration | Role enforcement (`VIEWER`, `EDITOR`, `OWNER`). |
| 117 | Comments on documents | I. Collaboration | Threaded discussions linked to document or text ranges. |
| 118 | Mentions and notifications | I. Collaboration | `@user` mentions generating user notifications. |
| 119 | Author and modification history | I. Collaboration | Audit trail of contributors per document. |
| 120 | Real-time presence indicators | I. Collaboration | Online collaborator avatars in document header. |
| 121 | Online collaborator indicators | I. Collaboration | Live status badge showing who is viewing the document. |
| 122 | Concurrency protection | I. Collaboration | OCC version checking preventing overwritten changes. |
| 123 | Version recovery after concurrent changes | I. Collaboration | Automatic preservation of conflicting edits in revisions. |
| 124 | Shared links with configurable permissions | I. Collaboration | Secret link sharing with read-only or edit capabilities. |
| 125 | Revoke access to shared documents | I. Collaboration | Single-click revocation of shared links and member access. |
| 126 | Publish document | J. Publishing & Adv | One-click public publishing with vanity slug. |
| 127 | Read-only document view | J. Publishing & Adv | Clean reading view without editing chrome. |
| 128 | Public or private sharing settings | J. Publishing & Adv | Granular privacy toggles per document. |
| 129 | Document cover images | J. Publishing & Adv | Header cover banner with upload and presets. |
| 130 | Document icons | J. Publishing & Adv | Emoji or monochrome icon identifier in title and tree. |
| 131 | Custom page layouts | J. Publishing & Adv | Full-width vs centered narrow reading width toggle. |
| 132 | Linked documents and backlinks | J. Publishing & Adv | `[[Document]]` wiki-links with automatic backlink tracker. |
| 133 | Document relationships | J. Publishing & Adv | Parent, child, and linked document graph relationships. |
| 134 | Embedded content | J. Publishing & Adv | Secure sandboxed embeds (YouTube, Vimeo, CodePen, iFrames). |
| 135 | Callout blocks | J. Publishing & Adv | Highlighted callout boxes with icon and text. |
| 136 | Toggle sections | J. Publishing & Adv | Collapsible accordion blocks for detail folding. |
| 137 | Columns and layout blocks | J. Publishing & Adv | Multi-column side-by-side block layouts. |
| 138 | Database embeds | J. Publishing & Adv | Embedded table and list view widgets. |
| 139 | Print-friendly layouts | J. Publishing & Adv | Dedicated `@media print` CSS stylesheet. |
| 140 | Document activity timeline | J. Publishing & Adv | Chronological timeline of edits, comments, and shares. |
| 141 | Enforce document ownership | K. Security & Reliability | User and workspace ownership checked on every request. |
| 142 | Verify workspace membership | K. Security & Reliability | Server validates `WorkspaceMember` before granting access. |
| 143 | Server-side view/edit enforcement | K. Security & Reliability | Unauthorized PUT/DELETE requests rejected with 403 Forbidden. |
| 144 | Prevent ID manipulation | K. Security & Reliability | Access denied when requesting document from unauthorized workspace. |
| 145 | Validate uploaded files | K. Security & Reliability | MIME-type sniffing, extension checks, and size bounds. |
| 146 | Safe deletion & restoration | K. Security & Reliability | Soft-deleted documents can be restored without data loss. |
| 147 | Test autosave & network recovery | K. Security & Reliability | Automated test verifying recovery after network interruption. |
| 148 | Test large documents | K. Security & Reliability | Verified rendering and editing performance with >100,000 words. |
| 149 | Test editor keyboard accessibility | K. Security & Reliability | Full keyboard navigation through all editor tools and menus. |
| 150 | Test import/export fidelity | K. Security & Reliability | Automated round-trip tests for Markdown, HTML, and Text. |
| 151 | Test concurrent updates | K. Security & Reliability | Automated test verifying conflict detection on stale version writes. |
| 152 | Back up document data & recovery | K. Security & Reliability | Documented PostgreSQL backup and export verification process. |
