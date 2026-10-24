# Project Atlas / KRONOS — Team Collaboration Implementation Plan

## 1. Overview & Objectives

Transform Project Atlas / KRONOS into an authenticated, production-grade team development workspace supporting multiple developers collaborating across real codebases, tasks, Git branches, code reviews, and discussions.

---

## 2. Sequential Implementation Stages

### Stage 1: Architecture Audit & Schema Definition
- [x] Audit existing models in `prisma/schema.prisma`.
- [x] Design extensions for `CodeReview`, `CodeReviewComment`, `CodeReviewAction`, and `TaskCollaborator`.
- [x] Push schema updates safely via `prisma db push` without data loss (executed in 489ms with 0 data loss).
- [x] Regenerate Prisma client and synchronize types for both backend and frontend.

### Stage 2: Workspace Membership, Roles & Invitations
- [x] Implement & verify `backend/src/routes/collaboration.ts` workspace invitation endpoints:
  - Generate secure cryptographic tokens (SHA-256 hashed).
  - Acceptance flow with authenticated binding (`POST /api/invitations/accept`).
  - Member role updating and removal with RBAC hierarchy in `collaboration-auth.ts`.
- [x] Add workspace switching endpoints (`GET /api/collaboration/workspaces`, `POST /api/collaboration/workspaces`).
- [x] Ensure strict role-based authorization preventing cross-workspace escalation.

### Stage 3: Shared Tasks & Multi-Collaborator Management
- [x] Update `backend/src/routes/tasks.ts` and `tasks-service.ts` to support:
  - Multi-collaborator assignments (`POST /api/tasks/:id/collaborators`, `DELETE /api/tasks/:id/collaborators/:userId`).
  - Acceptance criteria validation.
  - Status lifecycle enforcement (`TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE`).
  - Associating repositories and feature branches.

### Stage 4: Repository Details & Linked Tasks Verification
- [x] Connect repository details drawer modal:
  - Overview: Live branch, latest commit, working tree state.
  - Branches: Real Git branches.
  - Commits: Real Git commit history with author and timestamp.
  - Changes: Live working tree status and diff viewer.
  - Linked Tasks: Genuine task selector, branch linking, and unlink actions (`POST /api/repositories/:id/link-task`).

### Stage 5: Code Reviews & Diff Engine
- [x] Create `backend/src/routes/reviews.ts`:
  - `POST /api/reviews` — Create review from source branch to target branch.
  - `GET /api/reviews` — List reviews in workspace/repository.
  - `GET /api/reviews/:id` — Get review metadata, live commit range, and diff via `GitService.getBranchDiff`.
  - `POST /api/reviews/:id/comments` — Add file/line or general review comment.
  - `POST /api/reviews/:id/actions` — Approve, request changes, or close review with anti-self-approval enforcement.

### Stage 6: Comments, Mentions & Real-Time Presence
- [x] Connect user mention detection (`@username`) across tasks, reviews, and notes.
- [x] Send structured notifications on mention or task assignment (`prisma.notification`).
- [x] Connect SSE stream (`/api/collaboration/events/stream`) and presence heartbeat (`/api/collaboration/presence/heartbeat`).

### Stage 7: Premium Monochrome Collaboration UI
- [x] Create `frontend/src/app/collaboration/page.tsx`:
  - Team members table with roles, status, and permissions.
  - Send Invitation modal with role selector and expiration.
  - Workspace switcher and creation dialog.
  - Real-time team presence indicator with telemetry counters.
  - Shared activity audit feed.
- [x] Create `frontend/src/app/reviews/page.tsx`:
  - Code reviews list with status badges (`OPEN`, `APPROVED`, `CHANGES_REQUESTED`, `CLOSED`).
  - Code review creation modal with repository selector and branch targets.
  - Review inspector drawer with unified syntax-highlighted git diff and discussion comments.

### Stage 8: Integration & End-to-End Automated Testing
- [x] Create `backend/scripts/test-collaboration-e2e.ts` verifying the full 20-step multi-user lifecycle with zero mock data.
- [x] Verified 35 / 35 checks passed (100%).
- [x] Verified `backend/scripts/test-repository-git-e2e.ts` 29 / 29 checks passed (100%).

### Stage 9: Verification & Documentation
- [x] Run `npx tsc --noEmit` on frontend and backend (0 errors).
- [x] Run `npm run build` on frontend (21/21 routes compiled cleanly in Turbopack).
- [x] Update `docs/COLLABORATION_IMPLEMENTATION_AUDIT.md` with complete evidence.
