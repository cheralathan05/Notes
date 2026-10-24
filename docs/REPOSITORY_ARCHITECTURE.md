# KRONOS / Project Atlas — Repositories & Git Architecture

## 1. System Overview & Product Mission

Project Atlas Repositories & Codebases bridges software development workflows with structured task intelligence, cryptographic evidence verification, and AI-assisted workspace operations.

The system integrates real Git repositories into the sovereign workspace without mock data, fake synchronizations, or destructive side-effects.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KRONOS WEB WORKSPACE                            │
│  - Modern Monochrome UI (Plus Jakarta Sans + JetBrains Mono)           │
│  - Real-time Git Inspection: Branches, Commits, Changes & Diff Viewer  │
│  - Task Association & Verification Badge Inspector                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / Cookie / Bearer
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        PROJECT ATLAS BACKEND                           │
│  - Express.js API + Router Middleware (Workspace Isolation)            │
│  - GitService (Safe `execFile` argument execution, path verification) │
│  - Task Evidence & Verification Evaluation Engine                      │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│        POSTGRESQL STORAGE         │ │         LOCAL GIT DAEMON         │
│  - `repositories`                 │ │  - Local working tree detection  │
│  - `tasks` & `task_evidence`      │ │  - Safe `status`, `log`, `diff`  │
│  - `developer_tokens`             │ │  - Atlas CLI (`atlas connect`)   │
└───────────────────────────────────┘ └──────────────────────────────────┘
```

---

## 2. Architectural Components

### 2.1 GitService Process Model (`backend/src/lib/git-service.ts`)
- **Safe Execution**: Uses `child_process.execFile` with argument arrays. Strictly prohibits shell interpolation (`sh -c` or `cmd /c`), preventing arbitrary command injection.
- **Resource Constraints**: Enforces `maxBuffer: 4MB` and strict timeouts (`8000ms`), with automatic process killing on runaway jobs.
- **Environment Sanitation**: Operates under `LC_ALL: 'C'` (deterministic CLI parsing across locales) and `GIT_TERMINAL_PROMPT: '0'` (disallows interactive credential blocking).
- **Filesystem Security**: Resolves all relative file requests against the validated repository root. Any path traversal outside the top-level repository root (`path.resolve(rootDir, targetFile)`) is blocked and rejected with an access-denied exception.
- **Non-Destructive Guarantee**: Strictly read-only operations. Never executes `git reset --hard`, `git clean -f`, force pushes, or automatic checkout overwrites.

### 2.2 Database Persistence Schema (`prisma/schema.prisma`)
The repository registry entity models persistent metadata:

```prisma
model Repository {
  id            String    @id @default(cuid())
  workspaceId   String    @map("workspace_id")
  projectId     String?   @map("project_id")
  name          String
  slug          String
  gitUrl        String?   @map("git_url")
  defaultBranch String    @default("main") @map("default_branch")
  localPath     String?   @map("local_path")
  description   String?
  status        String    @default("CONNECTED")
  lastSyncedAt  DateTime? @map("last_synced_at")
  latestCommit  String?   @map("latest_commit")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project       Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  tasks         Task[]

  @@unique([workspaceId, slug])
  @@index([workspaceId])
  @@index([projectId])
  @@map("repositories")
}
```

### 2.3 Task-to-Repository Association
Tasks reference their source repository via `repositoryId` and target feature branch via `branchName`:
- When commits are inspected via `GitService.getCommits()`, commit messages are scanned for task references (`[TASK-id]`, `#id`).
- When tests or checks are executed via the Atlas CLI or UI, execution evidence (`exitCode`, `stdoutSnippet`, `commitHash`, `branch`) is attached to `task_evidence`.
- Server-side completion gates require exit code 0 and satisfaction of all acceptance criteria before marking a task `isVerified: true`.

---

## 3. Atlas CLI Bridge Workflow

```
1. Developer runs `atlas connect` inside any local Git project.
2. CLI reads Git metadata via `getLocalGitInfo()`:
   - Git top-level root directory
   - Current checked-out branch
   - Latest commit hash and message
   - Configured remote origin URL
   - Modified/uncommitted files
3. CLI authenticates to Backend using Developer Token (`Bearer atlas_dev_...`).
4. CLI invokes `POST /api/repositories/connect`.
5. Backend verifies workspace membership, validates Git metadata, and upserts the repository record idempotently.
6. Local config is saved to `.atlas/project.json`.
7. Web dashboard refreshes, rendering the live repository with real branches, commits, and diff inspection.
```

---

## 4. API Specification

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/repositories` | `GET` | List workspace repositories enriched with live Git metadata |
| `/api/repositories` | `POST` | Register repository (validates local path or remote Git URL) |
| `/api/repositories/connect` | `POST` | CLI connection endpoint with idempotent upsert |
| `/api/repositories/:id` | `GET` | Retrieve repository details, project, and linked tasks |
| `/api/repositories/:id/sync` | `POST` | Trigger live synchronization of repository state |
| `/api/repositories/:id/branches` | `GET` | Read real local and remote branches from working tree |
| `/api/repositories/:id/commits` | `GET` | Read real commit history with task cross-referencing |
| `/api/repositories/:id/status` | `GET` | Read real working tree status (clean / modified files) |
| `/api/repositories/:id/diff` | `GET` | Fetch safe unified diff preview for modified files |
| `/api/repositories/:id/link-task` | `POST` | Link a workspace task to repository and branch |
| `/api/repositories/:id/unlink-task` | `POST` | Unlink a workspace task from repository |
| `/api/repositories/:id` | `PATCH` | Update repository metadata (name, project, description) |
| `/api/repositories/:id` | `DELETE` | Disconnect repository from workspace (Admins only) |
