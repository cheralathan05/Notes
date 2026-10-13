# KRONOS DOCUMENTS & NOTES — TEST & VERIFICATION PLAN

## 1. Quality Gates & Objectives

Every feature in the 152-item inventory must be tested against:
1. **Schema Integrity**: PostgreSQL migration consistency and foreign key cascade rules.
2. **Authorization Boundaries**: User A cannot read, edit, or delete User B's private documents or cross workspace boundaries.
3. **Data Integrity & Concurrency**: Optimistic concurrency control (OCC) prevents silent overwrites; autosave debouncing prevents payload floods; revisions correctly snapshot past states.
4. **Editor Fidelity**: Rich content (headings, tables, lists, code, images, links) converts cleanly to and from storage format without data loss.
5. **Import/Export Round-Trip**: Exported Markdown, HTML, and Text match imported counterparts.
6. **AI Reliability**: Graceful degradation when AI endpoints are unreachable; accurate in-document and cross-workspace retrieval.

---

## 2. Test Execution Matrix

| Test Suite | Target Component | Verifications |
|---|---|---|
| `TS-01: Document CRUD` | Backend API | Creation, reading by ID, listing by workspace, updating title/content, soft deletion, restore, and permanent deletion. |
| `TS-02: OCC & Autosave` | Backend API + Frontend | Concurrent updates with mismatched version throw `409 Conflict`. Debounced saves commit to PostgreSQL. |
| `TS-03: Revision History` | Backend API | Snapshot creation on save; list revisions; restore revision rollback updates document content and version. |
| `TS-04: Hierarchy & Folders` | Backend API + Tree | Nested parent-child documents, folder assignment, and drag-and-drop reorder index updates. |
| `TS-05: Attachments & Media` | Upload Engine | File upload validation (type, size), database attachment record creation, and authorized file retrieval. |
| `TS-06: Templates & Seeding` | Template Engine | System templates (Meeting, Project Plan, Journal, etc.) instantiate into working documents. |
| `TS-07: Search Engine` | Search API | Search indexing across titles and content, filtering by status and favorites. |
| `TS-08: AI Document Tools` | AI Module | Summarization, rewriting, action item extraction, and fallback when model offline. |
| `TS-09: Import / Export` | Converter Module | Markdown export/import, HTML export, Plain text export. |
| `TS-10: Production Build` | Next.js + TSC | Frontend `next build` and backend `tsc --noEmit` exit 0 with strict mode. |
