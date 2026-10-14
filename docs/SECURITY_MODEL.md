# Security Model & Threat Boundary Specification
## Project Atlas — AI Developer Operating System

**Standard:** Zero-Trust Client Execution, Server-Authoritative Boundaries, Least Privilege Access, Redaction of Secrets.

---

## 1. Authentication & Identity Boundaries

Project Atlas connects four client interfaces (Web Application, Terminal TUI, Developer CLI, and VS Code Extension) to a single authoritative backend.

### 1.1 Dual-Channel Authentication Architecture

| Client Type | Authentication Mechanism | Transport & Storage | Revocation & Expiration |
| :--- | :--- | :--- | :--- |
| **Web Browser** | HTTP-Only, Secure, SameSite Session Cookie | `Set-Cookie: session_token=...` | Explicit logout (`DELETE /api/auth/logout`) or session expiry (14 days) |
| **Developer CLI & TUI** | Developer API Token (`atlas_dev_...`) or Bearer Session Token | `Authorization: Bearer <token>` or `x-atlas-token` header, stored in user home `~/.atlas/config.json` | Web UI Token Manager revocation or explicit `atlas logout` |
| **VS Code Extension** | Secure Token storage in VS Code SecretStorage | `Authorization: Bearer <token>` | `Atlas: Disconnect Platform` command |

### 1.2 Cryptographic Token Storage
- Plaintext API tokens and session tokens are **NEVER** stored in the database.
- Every token is hashed using `SHA-256`:
  $$\text{tokenHash} = \text{SHA-256}(\text{rawToken})$$
- Database lookups search exclusively by `tokenHash`. Even in the event of an unauthorized database dump, token hashes cannot be used to authenticate requests.

---

## 2. Server-Authoritative Workspace & Tenant Isolation

- **Tenant Isolation:** Every task, repository, project, document, and automation record is tagged with a mandatory `workspaceId`.
- **Server-Side Membership Verification:**
  - Before executing any read, write, claim, or deletion operation, the backend verifies that the authenticated user possesses an active membership in the target workspace via `verifyWorkspaceMembership(userId, workspaceId)`.
  - Attempts to supply a forged `workspaceId` or cross-tenant entity ID immediately result in `403 FORBIDDEN`.
- **Role-Based Access Control (RBAC):**
  - Roles: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`.
  - Destruction operations (deleting projects, revoking repositories) require `OWNER` or `ADMIN` roles.

---

## 3. Local Command Execution Security

### 3.1 Non-Negotiable Local Trust Rules
- **No Remote Shell Injection:** The web platform **NEVER** executes arbitrary shell commands on a developer's computer.
- **Local Initiation:** All test executions, build checks, and Git operations are strictly initiated locally by the developer via the CLI (`atlas checks run`, `atlas task submit`) or VS Code extension.
- **Controlled Command Allowlists & Explicit Prompts:**
  - Standard commands default to project configurations (e.g. `npm test`, `npm run typecheck`).
  - Custom shell commands require explicit interactive confirmation from the user in the terminal.
  - Subprocess execution enforces explicit timeouts (default 60 seconds) to prevent infinite loops or hanging processes.

### 3.2 Output Truncation & Secret Redaction
- Standard output and error streams captured during check execution are truncated to the most recent 800 bytes (`stdoutSnippet`, `stderrSnippet`) to prevent memory overflows.
- Credentials, bearer tokens, and private environment variables are redacted before submitting evidence to the server.

---

## 4. Deterministic Completion Policy & Tamper Resistance

A task cannot be marked `DONE` simply by calling a status transition endpoint or clicking a checkbox.

### 4.1 Server-Side Gating Rules
When evidence is submitted via `POST /api/tasks/:id/evidence`:
1. **Exit Code Evaluation:** The executed command must yield a genuine exit code `0`. Any non-zero exit code (`1`, `127`, etc.) classifies the evidence as `FAILED` and blocks completion.
2. **Acceptance Criteria Verification:** All items in `Task.acceptanceCriteria` must evaluate to `isCompleted === true`.
3. **Exclusive Lease Validation:** If the task is claimed by another user whose lease has not expired, submissions from unassigned developers are rejected with `409 CONFLICT`.
4. **Verified Badge Issuance:** Only when all conditions are satisfied simultaneously does the server mark `isVerified: true`, `status: DONE`, and timestamp `verifiedAt`.

---

## 5. AI Developer Assistant Guardrails

- **Advisory Role Only:** AI suggestions (such as generated coding plans, test suggestions, and PR drafts) are treated as untrusted advisory proposals.
- **No Direct Shell or Filesystem Access:** AI models cannot execute shell commands or overwrite local source code without developer review and explicit approval.
- **Data Grounding:** AI queries only access authorized task descriptions, acceptance criteria, and project documentation within the authenticated workspace. Cross-workspace context is blocked by design.
