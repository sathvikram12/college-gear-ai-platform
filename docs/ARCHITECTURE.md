# COLLEGE GEAR — Architecture

## Overview
COLLEGE GEAR is deployed as one Next.js (App Router) application. React pages render the UI; a single catch-all route handler (`/api/[...path]`) acts as the backend front controller, delegating to an **Express-style layered backend** in `src/server`.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser (React 19 client)                      │
│  Pages: Landing · Auth · Command Center · Jarvis · Notes · Quizzes …  │
│  lib/api.ts (fetch /api/*, httpOnly cookies)  — no secrets in bundle  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ REST (JSON / multipart)
┌───────────────────────────────▼──────────────────────────────────────┐
│  src/app/api/[...path]/route.ts  →  src/server/dispatch.ts            │
│   1. global rate limit (per IP)                                       │
│   2. route match (router.ts, static segments win)                     │
│   3. CSRF same-origin check for mutations                             │
│   4. ensureSeeded() (once per process, advisory-locked)               │
│   5. controller (routes/*.ts) ── centralised handleError()            │
├──────────────────────────────────────────────────────────────────────┤
│  Middleware-like guards: requireUser() / requireRole('admin')         │
│   JWT (jose, HS256, 15m) → silent refresh via rotating refresh token  │
│  Validation: Zod schemas (schemas.ts)                                 │
├──────────────────────────────────────────────────────────────────────┤
│  Services: logic.ts (scoring, streak, ICS) · ai/services.ts           │
│  AI client: ai/gemini.ts (JSON mode, Zod validate, retry, sanitise)   │
├──────────────────────────────────────────────────────────────────────┤
│  Data access: Drizzle ORM (parameterised SQL)                         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                     ┌──────────▼──────────┐        ┌──────────────────┐
                     │     PostgreSQL      │        │  Google Gemini   │
                     │  38 tables, FKs,    │        │ (server-side key)│
                     │  indexes, triggers  │        └──────────────────┘
                     └─────────────────────┘
```

## Request flow (CRUD)
```
Frontend
   ↓  PUT /api/notes/:id  {title, content, tags}
REST API (dispatch.ts)
   ↓
Express-style router → notes controller
   ↓
Authentication (requireUser: verified JWT → req user id)
   ↓
Zod validation (noteSchema)
   ↓
Service / Drizzle query  WHERE id = :id AND user_id = <token user>
   ↓
PostgreSQL  →  { success: true, data }
```

## AI flow (Jarvis)
```
Frontend (Jarvis chat)
   ↓  POST /api/jarvis/chat { message, conversationId? }
Jarvis API controller  (requireUser, rate limit 30 AI calls / 10 min)
   ↓
Backend AI service  jarvisService()
   • system prompt (policy, no invented policies, no secret disclosure)
   • student context (only fields the student supplied)
   • last 10 messages of history
   ↓
Gemini  (responseMimeType: application/json)
   ↓
Zod validation  (jarvisResponseSchema; action hrefs whitelisted) — retry once
   ↓
Database  (user + assistant messages saved atomically after success)
   ↓
Frontend  (answer · steps · resources · confidence · action buttons)
```
Failures map to `AI_NOT_CONFIGURED (503)`, `AI_RATE_LIMITED (429)` or `AI_UNAVAILABLE (502)`; the client offers **Retry** without duplicating stored messages.

## Data isolation
Every student-owned query filters by the user id derived from the verified JWT (`requireUser()`), never from request bodies. Ownership helpers (`ownNote`, `ownConversation`, `ownSession`…) return 404 for other users' records. Admin endpoints use `requireRole('admin')`, which re-reads role and active status from the database.

## Session model
- Access token: JWT (HS256) in `cg_access` httpOnly cookie, 15 minutes.
- Refresh token: 32 random bytes in `cg_refresh` httpOnly cookie; only its SHA-256 hash is stored in `refresh_tokens`; rotated on every use; revoked on logout / password change.

## Code execution safety
Student code is **never** executed in the Node.js server process. JavaScript runs in a Web Worker (no DOM, network APIs removed, 5 s timeout, terminated after run); Python runs in Pyodide (WebAssembly) inside a Web Worker. Java/C/C++ run only via an external Judge0 sandbox when `JUDGE0_URL` is configured; otherwise execution is disabled with a clear message.

## Uploads
Multipart parsed in memory; extension + magic bytes validated; size limit `UPLOAD_MAX_SIZE_MB`; text extracted with `unpdf` / `mammoth`; files are never written to disk or executed. Only metadata and the AI report are stored.
