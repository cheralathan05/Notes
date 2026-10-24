# Project Atlas — Repository Implementation Plan

## Overview
This implementation plan outlines the engineering phases executed to deliver production-grade Repositories & Codebases integration for KRONOS / Project Atlas.

---

## Phase 1 — Discovery & Architecture Audit
- [x] Audit database schema (`prisma/schema.prisma`), ORM configurations, and workspace relations.
- [x] Audit existing backend routes (`backend/src/routes/repositories.ts`) and task evidence policies (`task-evidence.ts`).
- [x] Audit Atlas CLI architecture (`cli/src/git.ts`, `cli/src/index.ts`, `cli/src/api-client.ts`).
- [x] Audit existing frontend (`frontend/src/app/repositories/page.tsx`, `frontend/src/lib/api.ts`).
- [x] Formulate architecture blueprint in `docs/REPOSITORY_ARCHITECTURE.md`.

---

## Phase 2 — Database & Schema Migration
- [x] Extend `model Repository` in `prisma/schema.prisma`:
  - `status String @default("CONNECTED")`
  - `lastSyncedAt DateTime? @map("last_synced_at")`
  - `latestCommit String? @map("latest_commit")`
- [x] Execute safe schema push (`npx prisma db push --schema=../prisma/schema.prisma`) without data loss.
- [x] Regenerate Prisma client in root and backend node modules (`npm run prisma:generate`).

---

## Phase 3 — Git Integration Engine
- [x] Implement `GitService` in `backend/src/lib/git-service.ts`:
  - `isGitRepository(repoPath)`: Verifies genuine Git working tree.
  - `getRepositoryMetadata(repoPath)`: Extracts branch, remote, latest commit, and clean state.
  - `getBranches(repoPath)`: Discovers local and remote tracking branches.
  - `getCommits(repoPath, limit)`: Extracts real commit logs and auto-links task references.
  - `getWorkingTreeStatus(repoPath)`: Parses porcelain output into structured file statuses.
  - `getDiff(repoPath, targetFile)`: Generates safe unified diff with path traversal protection.
- [x] Enforce process isolation via `execFile` with argument arrays, non-interactive flags, timeouts, and buffers.

---

## Phase 4 — Backend API & Authorization
- [x] Upgrade `backend/src/routes/repositories.ts` with authenticated endpoints:
  - `GET /api/repositories`: Workspace list enriched with live Git metadata.
  - `GET /api/repositories/:id`: Repository detail with project and linked tasks.
  - `POST /api/repositories`: Registration supporting local paths and remote Git URLs.
  - `POST /api/repositories/connect`: CLI connection endpoint with idempotent upsert.
  - `POST /api/repositories/:id/sync`: Live state synchronization.
  - `GET /api/repositories/:id/branches`: Real branches listing.
  - `GET /api/repositories/:id/commits`: Real commit history with task cross-referencing.
  - `GET /api/repositories/:id/status`: Real working tree status.
  - `GET /api/repositories/:id/diff`: Safe unified diff viewer.
  - `POST /api/repositories/:id/link-task` & `POST /api/repositories/:id/unlink-task`: Task association.
  - `DELETE /api/repositories/:id`: Role-restricted repository deletion (`OWNER`, `ADMIN`).

---

## Phase 5 — Atlas CLI Synchronization
- [x] Update `cli/src/git.ts`:
  - Capture full commit hash (`latestCommitHash`) and subject message (`latestCommitMessage`).
- [x] Update `cli/src/api-client.ts`:
  - Support `latestCommit` payload in `connectRepository`.
  - Add `syncRepository` API caller.
- [x] Update `cli/src/index.ts`:
  - Add friendly non-Git directory validation and guidance in `handleConnect`.
  - Transmit live commit data to backend on connection.
- [x] Verify CLI build (`npm run build` in `cli/`).

---

## Phase 6 — Frontend World-Class Monochrome Interface
- [x] Update `frontend/src/lib/api.ts` with Repository, Branch, Commit, Tree Status, and Diff types.
- [x] Redesign `frontend/src/app/repositories/page.tsx`:
  - Disciplined monochrome aesthetic matching KRONOS design system.
  - Global metrics bar (Total Repositories, Local Worktrees, Linked Tasks, Clean Trees).
  - Search by name, slug, or path with real-time filtering.
  - Project, Status, and Sort filters.
  - First-class empty onboarding state with copyable `atlas connect` and developer token guidance.
  - High-information technical repository cards with live branches, commit hashes, clean tree indicators.
  - Dedicated **Repository Details Inspector**:
    - Overview Tab (filesystems, remotes, default branch, sync timestamp).
    - Branches Tab (local/remote branches, checkout helper).
    - Commits Tab (commit history, short hashes, author, task linkages).
    - Changes & Diff Tab (modified files list, interactive unified diff preview).
    - Linked Tasks Tab (link/unlink workspace tasks, feature branches, evidence status).
  - Multi-tab Connect Repository Wizard (CLI, Local Path, Remote URL).

---

## Phase 7 — Verification & Automated Testing
- [x] Implement comprehensive E2E integration test suite (`backend/scripts/test-repository-git-e2e.ts`):
  - Provisions real temporary Git repository.
  - Verifies GitService methods (branches, commits, working tree, diff).
  - Verifies database persistence and idempotent upsert.
  - Verifies task linking through foreign key relations.
  - Verifies security protections (non-Git directory rejection, path traversal blocking).
  - Verifies safe disconnection and fixture cleanup.
- [x] Execute TypeScript and build checks across all subprojects:
  - Frontend (`npm run build` -> 19 routes compiled successfully).
  - Backend (`npm run typecheck` -> 0 errors).
  - CLI (`npm run build` -> 0 errors).
- [x] Document audit results in `docs/REPOSITORY_IMPLEMENTATION_AUDIT.md`.
