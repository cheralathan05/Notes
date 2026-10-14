# Architecture Decision Record: Project Atlas — AI Developer Workspace

## 1. System Overview & Product Mission
Project Atlas bridges the team's central web platform with the developer's local VS Code terminal and coding environment. It unifies project planning, task management, code execution evidence, and AI assistance through a single authenticated PostgreSQL backend.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WEB APPLICATION (Next.js 16 + React 19)              │
│   Projects • Tasks • Acceptance Criteria • Repositories • Reviews • AI │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ HTTPS / REST / SSE
┌─────────────────────────────────▼──────────────────────────────────────┐
│                    AUTHENTICATED BACKEND (Express.js)                  │
│   Shared Domain Services • Authorization Policies • OCC Concurrency    │
│   Task Leases • Verification Evidence Engine • AI Provider Adapters   │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │                               │
┌───────────────▼───────────────┐ ┌─────────────▼────────────────────────┐
│      POSTGRESQL + PRISMA      │ │    DEVELOPER WORKSPACE (VS Code)     │
│  Repositories • Tasks • Leases│ │  Developer CLI (TypeScript)          │
│  Evidence • Workspaces • Users│ │  VS Code Extension (TreeDataProvider)│
│  Automations • Notifications  │ │  Local Git Detection & Real Checks   │
└───────────────────────────────┘ └──────────────────────────────────────┘
```

## 2. Shared Business Logic Architecture
All client entry points (Web GUI, Developer CLI, VS Code Extension, and In-App Terminal) invoke the exact same server-side domain services:
- **Authentication**: Web uses HttpOnly Argon2id session cookies; Developer CLI & VS Code Extension use high-entropy Developer Tokens (`atlas_dev_...` hashed with SHA-256 in DB).
- **Task Claim Leases**: When exclusive claiming is active, a developer claims a task, setting `claimedById` and `leaseExpiresAt`. Concurrent claims are rejected.
- **Evidence-Based Completion**: A task cannot transition to `DONE` without satisfying defined acceptance criteria and submitting genuine execution evidence (exit code 0, commit hash, verified branch), unless overridden by an authorized `OWNER` or `ADMIN`.

## 3. Developer CLI & Local Tool Boundaries
- **No Direct Database Access**: The CLI communicates exclusively via the authenticated backend REST API.
- **No Unrestricted Remote Execution**: The website never executes commands on the developer's machine. The local CLI or VS Code extension runs user-approved local checks (e.g., `npm test`, `npm run typecheck`), captures genuine stdout/stderr summaries and exit codes, and transmits verified evidence upward to the platform.
- **Git Safety**: Local operations inspect branch and uncommitted files without destructive switches or discarding changes.

## 4. AI Developer Assistant Workflow
- Converts tasks and acceptance criteria into structured implementation plans.
- Proposes test plans and acceptance validation strategies.
- Summarizes commits and evidence into pull-request descriptions and handoff notes.
- Grounded strictly in authorized workspace data; unconfigured providers fail gracefully with clear instructions.
