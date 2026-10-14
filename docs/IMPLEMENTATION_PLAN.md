# KRONOS TASKS & PROJECT MANAGEMENT OS — IMPLEMENTATION PLAN

## Phase Overview & Dependency Sequence

The implementation proceeds in strict vertical stages. Every stage is validated with TypeScript checks and automated integration tests before proceeding to the next.

---

### Stage 1: Baseline Architecture & Planning (GATE 0)
- [x] Repository audit: Authentication, Documents, Workspace models.
- [x] Architecture & Business Rules specification documents in `docs/`.
- [x] Baseline test verification.

### Stage 2: Database Schema & Core Domain Services (GATE 1)
- [x] Extend `prisma/schema.prisma` with:
  - `Project` & `ProjectMember`
  - `Task` extensions (statuses, priorities, parentId, recurrenceId, projectId)
  - `TaskDependency` (Finish-to-Start blocking relationships)
  - `TaskChecklistItem`
  - `TaskLabel` & `TaskLabelAssignment`
  - `TaskComment`
  - `TaskActivity`
  - `TaskRecurrence`
  - `Milestone`
- [x] Generate Prisma Client and migrate database.
- [x] Central domain services `backend/src/lib/tasks-service.ts` and `projects-service.ts` for unified operations.

### Stage 3: Complete Task Management API & Detail Panel
- [x] Endpoints:
  - `GET /api/tasks` (filtered by project, status, assignee, priority, due date)
  - `POST /api/tasks` (create task)
  - `GET /api/tasks/:id` (fetch detail with subtasks, dependencies, checklist, comments)
  - `PATCH /api/tasks/:id` (update fields with status transition logic)
  - `DELETE /api/tasks/:id` (safe deletion)
  - `POST /api/tasks/bulk` (bulk complete, archive, assign, delete)
- [x] Frontend Task Detail Panel component with context preservation (`frontend/src/components/tasks/task-detail-panel.tsx`).

### Stage 4: Multi-View System (Kanban, List, My Day, My Tasks)
- [x] **Kanban Board**: Drag-and-drop between columns (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`), WIP limits, inline card creation (`frontend/src/components/tasks/task-kanban.tsx`).
- [x] **List View**: Sortable compact table with filters, search, inline editing, and bulk actions (`frontend/src/components/tasks/task-list.tsx`).
- [x] **My Day**: Smart focus queue for Today, Overdue, Upcoming, Blocked, and Completed (`frontend/src/components/tasks/my-day-view.tsx`).

### Stage 5: Project Management & Milestone Dashboard
- [x] Endpoints:
  - `GET /api/projects`
  - `POST /api/projects`
  - `GET /api/projects/:id`
  - `PATCH /api/projects/:id`
  - `DELETE /api/projects/:id`
  - `POST /api/projects/:id/progress`
  - `POST /api/projects/:id/milestones`
  - `PATCH /api/projects/:id/milestones/:mId`
- [x] Frontend Project Dashboard: Milestones, real-time progress, health indicators (`ON_TRACK`, `AT_RISK`, `OFF_TRACK`), linked documents (`frontend/src/components/tasks/project-manager.tsx`).

### Stage 6: Subtasks, Dependencies, and Blocker Intelligence
- [x] Cycle detection algorithm for DAG dependencies (`detectCycle` graph traversal).
- [x] Subtask progress rollup into parent task.
- [x] Blocker visual indicators on task cards and detail panels.

### Stage 7: In-App Terminal Command Center (Workspace CLI)
- [x] In-app terminal component (`frontend/src/components/tasks/terminal-command-center.tsx`) with shortcuts (`Ctrl + ~` / `Ctrl + \`).
- [x] Command Registry:
  - `help [command]`
  - `task list [--today] [--overdue] [--mine]`
  - `task create <title> [--priority] [--due] [--project]`
  - `task complete <id>`
  - `task reopen <id>`
  - `task status <id> <status>`
  - `task priority <id> <priority>`
  - `task due <id> <date>`
  - `task block <id> by <blockingId>`
  - `task subtask <id> <title>`
  - `task comment <id> <text>`
  - `task delete <id>`
  - `project list`
  - `project create <name>`
  - `project progress <id>`
  - `clear`
- [x] Autocomplete, arrow-key command history, structured monospace feedback, instant UI synchronization.

### Stage 8: Real-Time Synchronization & Collaborative Activity
- [x] SSE real-time stream endpoint `/api/tasks/events`.
- [x] Instant broadcast on task update, status change, and project recalculation.
- [x] Frontend live synchronization hook and status badge.

### Stage 9: Documents & Notes Deep Integration
- [x] Link tasks to documents; open source document directly from task detail panel.
- [x] Document-to-task batch converter (`POST /api/tasks/batch`).

### Stage 10: Verification & Master Acceptance Suite
- [x] End-to-end automated test script `backend/scripts/test-tasks-os-suite.ts` passed 100%.
- [x] Quality gates: TypeScript checks (`npx tsc --noEmit` on both frontend & backend passed).
- [x] Production build verification (`npm run build` on frontend passed).

### Stage 11: Project Atlas — Core Developer Operating System Architecture
- [x] Dual-channel authentication middleware (supporting HTTP-only session cookies alongside `Authorization: Bearer atlas_dev_...` and `x-atlas-token`).
- [x] Prisma database models: `DeveloperToken`, `Repository`, `TaskEvidence`, and `Task` lease/criteria/evidence relations.
- [x] Exclusive task claim lease engine (`POST /api/tasks/:id/claim`, `release`).
- [x] Acceptance criteria checklist engine (`PATCH /api/tasks/:id/criteria`).
- [x] Evidence-based completion gating (`POST /api/tasks/:id/evidence`) enforcing exit code 0 and all criteria satisfied.
- [x] AI Developer Assistant endpoints: coding plan, PR draft, handoff summaries.

### Stage 12: Multi-Interface Delivery & Interactive Terminal TUI
- [x] **Web Application**: Repositories management dashboard (`/repositories`), Developer Token modal (`DeveloperTokenModal`), Task Detail Panel with Criteria & Evidence tabs, real-time SSE updates.
- [x] **Interactive Terminal TUI**: Full-screen interactive application in `cli/src/tui/terminal-app.ts` launched via `product` or `atlas` with interactive login, registration, dashboard, task browser, check runner, and evidence submission.
- [x] **Developer CLI**: Full command-line tool with Git metadata detection, `atlas login`, `atlas connect`, `atlas task submit`, and `atlas doctor`.
- [x] **VS Code Extension**: Native `atlas-vscode` package with TreeDataProvider, status bar actions, check execution, and evidence submission.
- [x] Automated integration suite `test-developer-platform-suite.ts` passed 17/17 (100%).
