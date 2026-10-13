# KRONOS TASKS & PROJECT MANAGEMENT OS — KNOWN LIMITATIONS & FALLBACKS

## 1. External AI Provider Fallback
- When `OPENAI_API_KEY` or external LLM endpoint is not configured in `.env`, the AI Project Planner and Task Assistant gracefully activates the built-in heuristic NLP engine.
- This ensures 100% deterministic, high-quality testability and zero crashes in offline or air-gapped environments.

## 2. Real-Time Transport: SSE (Server-Sent Events)
- Rather than requiring a separate Stateful WebSocket or Redis Pub/Sub daemon which may fail in corporate proxy environments or serverless edge, real-time collaboration is built with native HTTP Server-Sent Events (`/api/tasks/events`) with automatic client reconnection and local event deduplication.
- This provides sub-second multi-user synchronization with zero external infrastructure overhead.

## 3. Email Delivery Sinks
- When `SMTP_*` or `RESEND_API_KEY` are not configured in local development, assignment and deadline notifications fall back to the safe development sink and in-app Notification Center.
- Actual delivery is never falsely reported as successful when an external provider fails.

## 4. Concurrency & Optimistic Reconciliations
- If two users simultaneously drag or update the same task, the server enforces transaction commit order, and the second user's client reconciles with the authoritative state via SSE update stream.
