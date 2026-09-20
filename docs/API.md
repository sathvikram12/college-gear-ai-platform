# COLLEGE GEAR — REST API

Base path: `/api`. No authentication — 🔒 marks endpoints scoped to the current browser workspace; 👑 marks admin tools (open to all visitors unless `ADMIN_PANEL_ENABLED=false`).

**Success** `{ "success": true, "data": … }` · **Error** `{ "success": false, "error": { "code": "…", "message": "…" } }`
Common errors: `400 VALIDATION_ERROR/BAD_REQUEST`, `403 FORBIDDEN/CSRF_BLOCKED`, `404 NOT_FOUND`, `405 METHOD_NOT_ALLOWED`, `409 CONFLICT`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR`, `502 AI_UNAVAILABLE`, `503 AI_NOT_CONFIGURED`.

## Health & system
| Method | Route | Auth | Response |
|---|---|---|---|
| GET | `/health` | – | `{ success, message: "COLLEGE GEAR API is running" }` |
| GET | `/system/status` | – | `{ ai: boolean, serverCodeExecution: boolean }` |

## Workspace (no login)
There is **no login, sign-up or password**. Each browser automatically receives a private anonymous workspace via the httpOnly `cg_workspace` cookie (set on first page load, or on the first API call). All endpoints below work without credentials and only ever return the current workspace's own data.

| Method | Route | Response |
|---|---|---|
| GET | `/workspace` | `{ user: { id, name, role, avatar } }` |

## Optional accounts
Accounts are **optional** — every feature works without one. Signing up converts the browser's current workspace into the account (data is kept) and signs the user in immediately. Sessions are a signed JWT (HS256, secret `JWT_SECRET`) in the httpOnly `cg_auth` cookie (Secure, SameSite=None, Partitioned, 7 days), backed by a server-side session row so logout revokes it. JWTs are never exposed to JavaScript or stored in localStorage. While signed in, every endpoint below is scoped to the account's user id.

| Method | Route | Auth | Body | Response / errors |
|---|---|---|---|---|
| POST | `/auth/register` | – | `{ name, email, password, confirmPassword }` | `201 { user }` + session cookie · 400 validation / already logged in · 409 email exists · 429 |
| POST | `/auth/login` | – | `{ email, password }` | `200 { user }` + session cookie · 401 `ACCOUNT_NOT_FOUND` / `INVALID_PASSWORD` · 403 disabled · 429 |
| POST | `/auth/logout` | – | – | `200 { loggedOut: true }` (session revoked; account and data kept) |
| GET | `/auth/session` | – | – | `200 { authenticated, user|null }` (never 401) |
| GET | `/auth/me` | account | – | `200 { user: { id, name, email, role, createdAt, lastLoginAt } }` · 401 |

Profile management for accounts uses the existing `GET/PUT /profile` endpoints below.

## Profile & dashboard
| Method | Route | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/profile` | 🔒 | – | user + profile |
| PUT | `/profile` | 🔒 | `{ name, department, degree, year, bio, skills[], careerInterests[] }` | updated profile |
| POST | `/profile/avatar` | 🔒 | multipart `avatar` (PNG/JPEG/WEBP ≤1MB, magic-byte checked) | `{ avatar }` |
| DELETE | `/profile/avatar` | 🔒 | – | `{ avatar: null }` |
| GET | `/dashboard` | 🔒 | – | stats, upcoming, activity, career snapshot, suggestions |
| GET | `/notifications` · POST `/notifications/read-all` | 🔒 | – | list / done |

## Notes
| Method | Route | Body / query |
|---|---|---|
| GET | `/notes` 🔒 | `?q=&tag=&archived=true&sort=updated|created|title` → `{ notes, tags }` |
| POST | `/notes` 🔒 | `{ title, content, tags[], pinned, archived }` → 201 |
| GET/PUT/DELETE | `/notes/:id` 🔒 | owner only (404 otherwise) |
| POST | `/notes/:id/ai` 🔒 | `{ action: summarize|explain|revision }` → `{ heading, content, points[] }` |

## Jarvis
| Method | Route | Body |
|---|---|---|
| POST | `/jarvis/chat` 🔒 | `{ message, conversationId? }` → `{ conversation, messages:[user, assistant] }` |
| GET | `/jarvis/conversations` 🔒 | `?q=` (searches titles & messages) |
| POST | `/jarvis/conversations` 🔒 | `{ title? }` |
| GET/DELETE | `/jarvis/conversations/:id` 🔒 | messages / delete |
| POST | `/jarvis/conversations/:id/messages` 🔒 | `{ message }` |
| DELETE | `/jarvis/conversations/:id/messages` 🔒 | clear conversation |

Assistant `structured` payload: `{ answer, summary, steps[], resources[{title,description}], confidence: high|medium|low, actions[{label, href}] }`.

## Quizzes
| Method | Route | Notes |
|---|---|---|
| GET | `/quizzes` 🔒 | `?q=&category=` with bank size and your best/average |
| GET | `/quizzes/:id` 🔒 | starts: random N questions, shuffled options, **no answers** |
| POST | `/quizzes/:id/attempts` 🔒 | `{ answers:[{questionId, optionId|null}], durationSeconds }` → `{ attempt, review[] }` (scored server-side) |
| GET | `/quizzes/attempts/me` 🔒 | attempt history |

## Interviews
| Method | Route | Body |
|---|---|---|
| GET | `/interviews/categories` 🔒 | – |
| GET | `/interviews/questions` 🔒 | `?q=&category=` |
| POST | `/interviews/sessions` 🔒 | `{ category, count }` → session + random questions |
| GET | `/interviews/sessions` · `/interviews/sessions/:id` 🔒 | history / detail with answers |
| POST | `/interviews/sessions/:id/answers` 🔒 | `{ questionId, answer }` |
| POST | `/interviews/sessions/:id/feedback` 🔒 | `{ answerId }` → answer with AI feedback |
| POST | `/interviews/sessions/:id/complete` 🔒 | – |

## Schedule
`GET /schedule` · `POST /schedule` · `PUT/DELETE /schedule/:id` · `GET /schedule/export.ics` · `POST /reminders` · `PUT/DELETE /reminders/:id` (🔒). Entry: `{ subject, courseCode, day 0-6 (Mon-Sun), startTime "HH:MM", endTime, room, teacher, type }`.

## Coding
`GET /code` (+ `serverExecution` flag) · `POST /code` · `GET/PUT/DELETE /code/:id` · `POST /code/run` `{ language, code, stdin }` → Judge0 result or `501 EXECUTION_DISABLED` (🔒).

## Resume & cover letters
| Method | Route | Body |
|---|---|---|
| GET | `/resume` 🔒 | `{ resume, versions }` |
| POST/PUT | `/resume` 🔒 | `{ template: classic|modern|minimal, data, snapshotLabel? }` |
| GET | `/resume/versions/:id` 🔒 | version data |
| POST | `/resume/ai-improve` 🔒 | `{ action: summary|bullets|project|skills|keywords|feedback, target?, jobDescription? }` → `{ text, items, matchedKeywords, missingKeywords, score }` |
| POST | `/cover-letter/generate` 🔒 | `{ jobTitle, company, jobDescription }` → letter with `sections` |
| GET | `/cover-letter` · `/cover-letter/:id` 🔒 | list / detail |
| PUT/DELETE | `/cover-letter/:id` 🔒 | `{ finalText }` |

## Assignments
`POST /assignments/upload` 🔒 multipart `file` (PDF/DOCX/TXT ≤ `UPLOAD_MAX_SIZE_MB`), `title`, `question` → `{ assignment, submission{ score, report{score, summary, strengths[], issues[], suggestions[]}, error } }` · `GET /assignments` · `GET/DELETE /assignments/:id`.

## Career & placements
`GET/PUT /career/profile` · `POST /career/recommendations` · `DELETE /career/recommendations/:id` · `GET /placements?department=` (🔒).

## Content
`GET /news?q=&category=` · `GET /news/live` (Hacker News) · `GET /announcements?q=&category=&priority=` · `POST /announcements/:id/read` · `GET /resources?q=&category=` (🔒).

## Community
`GET /forum/categories` · `GET /forum/posts?q=&category=` · `POST /forum/posts` `{ categoryId, title, content }` · `GET /forum/posts/:id` · `POST /forum/posts/:id/comments` `{ content }` · `DELETE /forum/posts/:id` (owner/admin) · `DELETE /forum/comments/:id` · `POST /forum/posts/:id/report` `{ reason }` (🔒).

## Admin 👑
| Resource | Routes |
|---|---|
| Analytics | `GET /admin/analytics` |
| Users | `GET /admin/users?q=` · `PUT /admin/users/:id` `{ role, isActive }` |
| Quizzes | `GET/POST /admin/quizzes` · `PUT/DELETE /admin/quizzes/:id` |
| Questions | `GET /admin/questions?quizId=&q=` · `POST /admin/questions` `{ quizId, question, options[{text,isCorrect}], explanation, difficulty, isArchived }` · `PUT /admin/questions/:id` · `DELETE /admin/questions/:id[?hard=true]` · `POST /admin/questions/generate` `{ quizId, topic, count }` |
| News / Announcements / Placements / Resources / Interviews | `GET/POST /admin/{name}` · `PUT/DELETE /admin/{name}/:id` |
| Moderation | `GET /admin/reports` · `PUT /admin/reports/:id` `{ status }` · `PUT /admin/forum/posts/:id` `{ isHidden }` |
