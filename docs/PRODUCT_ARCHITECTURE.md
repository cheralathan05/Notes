# KRONOS TASKS & PROJECT MANAGEMENT OS — PRODUCT ARCHITECTURE

## 1. System Overview

KRONOS Tasks & Project Management OS is an integrated, sovereign workspace system built on top of PostgreSQL, Prisma ORM, Express.js, Next.js (App Router), and a custom in-app terminal command engine.

Unlike disconnected task boards or isolated prototypes, every view (Kanban Board, List View, My Day, Calendar, Timeline/Gantt, In-App Terminal CLI, and Documents-to-Tasks Integration) derives from **a single authoritative PostgreSQL database model and shared backend domain services**.

---

## 2. Core Architecture Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KRONOS UNIFIED CLIENT                           │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │ Kanban Board │  List View   │    My Day    │ In-App Terminal CLI │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │ Calendar View│ Timeline/Gantt│ Team Capacity│ AI Project Planner  │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTP REST + SSE Real-Time Stream
┌────────────────────────────────────▼───────────────────────────────────┐
│                     BACKEND APPLICATION SERVICES                       │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Terminal Command Reg. │  │ Task Domain Svc │  │ Project Domain Svc│ │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Real-Time Event Hub   │  │ Dependency Engine│ │ Recurrence Worker│  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Prisma ORM Transactions
┌────────────────────────────────────▼───────────────────────────────────┐
│                    POSTGRESQL 16 PERSISTENCE ENGINE                    │
│  workspaces • users • projects • tasks • task_dependencies • labels    │
│  task_checklists • task_comments • task_activities • task_recurrences  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models & Relationships

1. **`Workspace` & `WorkspaceMember`**: Multitenant isolation boundary. Every task and project belongs strictly to a workspace.
2. **`Project` & `ProjectMember`**: Groups tasks around strategic milestones, target deadlines, ownership, and health indicators.
3. **`Task`**:
   - Statuses: `BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`.
   - Priorities: `URGENT`, `HIGH`, `MEDIUM`, `LOW`, `NONE`.
   - Fields: Title, description (Markdown), start date, due date, estimated hours, actual hours, completion timestamp, sort order.
   - Relations: Creator, Assignee, Project, Parent Task (subtasks), Linked Document.
4. **`TaskDependency`**:
   - Directed edge (`blockingTaskId` $\rightarrow$ `blockedTaskId`).
   - Type: `FINISH_TO_START`.
   - Enforces acyclic graph constraint (cycle detection).
5. **`TaskChecklistItem`**: Ordered checklist items within a task.
6. **`TaskLabel` & `TaskLabelAssignment`**: Categorization tags with color coding.
7. **`TaskComment`**: Threaded discussion on tasks with mentions.
8. **`TaskActivity`**: Complete immutable audit log of status changes, reassignments, deadline changes, and comments.
9. **`TaskRecurrence`**: Recurrence schedules (Daily, Weekly, Monthly, Custom) with idempotent next-occurrence generation.
10. **`Milestone`**: Target delivery milestones linked to projects and tasks.

---

## 4. In-App Terminal CLI Architecture

The in-app terminal is an authenticated, structured command interpreter:
- **Registry**: Commands like `task list`, `task create`, `task complete`, `project progress`, `task block`, etc.
- **Safety**: Pure typed parser — zero `eval()`, zero raw shell execution.
- **Execution**: Direct call to the exact same backend domain services as the GUI.
- **Output**: Structured JSON and formatted ANSI/monochrome monospace logs with undo tokens where supported.

---

## 5. Real-Time Synchronization Protocol

- Transport: HTTP SSE (Server-Sent Events) `/api/tasks/events` with reconnection handshake.
- Scope: Scoped by `workspaceId` and authorized user membership.
- Events: `TASK_CREATED`, `TASK_UPDATED`, `TASK_STATUS_CHANGED`, `TASK_DELETED`, `PROJECT_PROGRESS_UPDATED`, `COMMENT_ADDED`.
- Optimistic UI: Client applies update optimistically and reconciles upon SSE or HTTP response.

---

## 6. Security & Data Integrity

- Zero direct object reference vulnerabilities: access requires active `WorkspaceMember` or `ProjectMember`.
- Transactions: All multi-record mutations (subtask status propagation, milestone recalculation, dependency additions) run within `prisma.$transaction()`.
- Input validation: Rigorous schema validation and sanitization on all endpoints and terminal commands.
