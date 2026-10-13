# KRONOS TASKS & PROJECT MANAGEMENT OS — BUSINESS RULES & POLICIES

## 1. Task Lifecycle & Status Transitions

### Supported Statuses
1. `BACKLOG`: Work queued for future refinement.
2. `TODO`: Work scheduled and ready for immediate pickup.
3. `IN_PROGRESS`: Work currently under active development.
4. `IN_REVIEW`: Work awaiting peer review, QA, or manager sign-off.
5. `DONE`: Work verified and completed.
6. `CANCELLED`: Work abandoned or invalidated.

### Valid Transitions & State Rules
- **Moving to `DONE`**:
  - Automatically populates `completedAt = now()`.
  - Recalculates associated Project progress.
  - Checks if any blocked tasks can now be unblocked; logs `DEPENDENCY_UNBLOCKED` activity.
  - If recurring task: triggers generation of next occurrence schedule.
- **Reopening from `DONE` to `TODO` or `IN_PROGRESS`**:
  - Sets `completedAt = null`.
  - Recalculates associated Project progress downwards.
  - Flags any dependent tasks that relied on its completion as blocked again.
- **Moving to `CANCELLED`**:
  - Excluded from active completion percentages and overdue warnings.
  - Does not satisfy dependencies for blocked downstream tasks.

---

## 2. Priority Matrix

- `URGENT`: Blocker or critical release requirement. Highlighted in red/monochrome alert.
- `HIGH`: Major milestone deliverable.
- `MEDIUM`: Standard default priority for all newly created tasks.
- `LOW`: Nice-to-have or low-urgency enhancement.
- `NONE`: Unprioritized backlog idea.

---

## 3. Subtasks & Hierarchy

- Tasks can have nested subtasks (`parentId` $\rightarrow$ `Task.id`).
- Completing all subtasks prompts or auto-completes parent task based on workspace configuration.
- A parent task's progress is calculated as: `(Completed Subtasks / Total Subtasks) * 100%`.
- Deleting or archiving a parent task cascades to its subtasks transactionally.

---

## 4. Dependencies & Blocker Intelligence

- Type: `FINISH_TO_START` (Task B cannot start until Task A is `DONE`).
- **Acyclic Graph Enforcement**:
  - Adding a dependency checks for circular loops ($A \rightarrow B \rightarrow C \rightarrow A$).
  - If a cycle is detected, the transaction aborts with `CYCLE_DETECTED` (HTTP 400).
- **Blocked State**:
  - A task is considered `BLOCKED` if any of its upstream dependency tasks have `status != DONE`.
  - Moving a blocked task directly to `DONE` or `IN_PROGRESS` shows a confirmation warning.

---

## 5. Project Progress & Health Calculation

### Progress Calculation Formula
$$\text{Progress} = \frac{\text{Count of DONE tasks}}{\text{Total active tasks (excluding CANCELLED)}} \times 100\%$$
- Subtasks are counted in subtask breakdown, while root tasks drive overall project completion to prevent double-counting.

### Health Indicator Rules
- **`ON_TRACK`**: 0 overdue tasks, 0 critical blockers, $>80\%$ of milestone tasks on schedule.
- **`AT_RISK`**: $\ge 1$ overdue task OR $\ge 1$ unresolved blocker on high-priority task.
- **`OFF_TRACK`**: $\ge 3$ overdue tasks OR overdue milestone target date.

---

## 6. Recurrence Generation Policy

- Recurrence is schedule-anchored: completing a weekly task 2 days late generates the next task for the scheduled cadence, avoiding cadence drift.
- Idempotency key: `taskRecurrenceId_scheduledDate`.
- Background worker checks active recurrences every hour; duplicate execution produces zero redundant records.

---

## 7. In-App Terminal CLI Execution Rules

1. Pure command parser: Tokenizes command, options (`--today`, `--mine`), and quoted strings.
2. Authorization first: Identifies `userId` and `workspaceId` before any mutation.
3. Identical domain services: The CLI executes the exact same underlying service functions (`taskService.completeTask()`, `projectService.createProject()`).
4. Truthful outputs: Output prints the persistent record ID, status transition, and recalculated project progress.
5. Confirmation: Destructive commands (`task delete`, `project delete`) require `--force` flag or prompt interactive confirmation.
