# ⚙ COLLEGE GEAR
### *Your AI-Powered College Companion*

COLLEGE GEAR is a full-stack, AI-powered **Student Command Center** that unifies academic help (Jarvis AI), notes, quizzes, mock interviews, timetables, a coding lab, resume & cover-letter tools, assignment feedback, career guidance, placements analytics, news, announcements, resources and a moderated community — all backed by PostgreSQL with strict per-student data isolation.

---

## 1. Problem
Students juggle a dozen disconnected tools: notes in one app, timetables in another, interview prep on random sites, no personalised career guidance, and AI chatbots that know nothing about their context.

## 2. Solution
One secure workspace where every feature shares the student's profile and activity:
- Ask **Jarvis** *"I have a Python interview next week"* → structured plan + one-click links to the Programming quiz, Interview practice, Coding Lab, Schedule and Resume.
- The **Command Center dashboard** aggregates real database records: quiz average, streak, upcoming classes, recent activity, resume completion and personalised next-best actions.

## 3. Features
| Area | Highlights |
|---|---|
| Access | **Login is optional.** Every browser gets a private anonymous workspace automatically. Optional Sign up / Log in (bcrypt passwords, JWT in an httpOnly cookie, server-side sessions) ties data to an account; protected `/account` page for signed-in users |
| Jarvis | ChatGPT-style UI, conversation list/search, retry, copy, clear, delete; Gemini JSON output validated with Zod; whitelisted in-app action links |
| Notes | CRUD, tags, pin, archive, server-side search/filter/sort, AI summarize / explain / revision points |
| Quizzes | 8 categories × 15+ questions, random 15-question draws, shuffled options, timer with auto-submit, navigator, **server-side scoring**, explanations, attempt history |
| Interviews | 6 categories, 26 questions, random sessions, text answers, optional audio recording + browser dictation, AI coaching feedback (not a hiring decision) |
| Schedule | Weekly & daily views, study blocks, reminders, ICS export (weekly recurring events) |
| Coding Lab | Monaco editor, 5 languages, save/load sessions; JS & Python run in **isolated browser Web Workers** (no DOM/network, time limits); Java/C/C++ via optional Judge0 sandbox — never on the backend process |
| Resume | 9 sections, 3 templates, live preview, PDF export (print), versions, AI summary/bullets/project/skills/keyword-match/feedback — never invents facts |
| Cover letters | Structured JSON (opening/skills/experience/closing) from resume + JD, editable, TXT/PDF download |
| Assignments | PDF/DOCX/TXT upload (10 MB, magic-byte validation, never executed or stored), server text extraction, AI report `{score, summary, strengths, issues, suggestions}` |
| Career | Career profile, AI recommendations (paths, skills, courses, certifications, projects, higher studies), history |
| Placements | Recharts dashboards (rate, packages, offers, recruiters) — seed data clearly labelled **Demo** |
| News | Admin-curated (demo-labelled) + **live Hacker News API** |
| Announcements | Admin-managed with priority, expiry, search/filter, read tracking |
| Community | Categories, posts, comments, search, report, delete own, admin hide/delete/review reports |
| Admin | Analytics (charts + audit log), CRUD for users, quizzes, questions (+AI drafts saved archived for review), interviews, news, announcements, placements, resources, moderation |

## 4. Architecture & Tech Stack
> The hosting platform for this project requires **Next.js (App Router)**. The requested Express architecture is implemented as a layered backend inside Next.js route handlers: a single catch-all API entry (`src/app/api/[...path]/route.ts`) dispatches to an Express-style router with middleware, controllers (route modules), services and data access. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

- **Frontend:** React 19, Next.js 16 App Router, TypeScript, Tailwind CSS v4, Recharts, Monaco
- **Backend:** Next.js Node runtime route handlers, TypeScript, Zod, jose (JWT), bcryptjs
- **Database:** PostgreSQL + Drizzle ORM (parameterised queries), SQL migration file
- **AI:** Google Gemini via `@google/genai` — **server-side only**
- **Testing:** Vitest (unit + end-to-end API)

```
src/
  app/                 # pages (public, auth, protected (app)/*, admin) + api entry
  components/          # UI kit, Navbar, Footer, AuthProvider (ProtectedRoute/AdminRoute), admin
  lib/                 # client API wrapper + hooks
  db/                  # Drizzle schema (38 tables) + connection
  server/
    router.ts          # Express-style router
    dispatch.ts        # front controller: rate-limit → CSRF → route → errors
    http.ts            # response envelope, ApiError, error handler, rate limiter, audit log
    auth.ts            # bcrypt, JWT, refresh rotation, requireUser / requireRole
    schemas.ts         # Zod validation for every input
    logic.ts           # pure business logic (quiz scoring, streaks, ICS…)
    ai/gemini.ts       # Gemini client + structured JSON + Zod validation + retry
    ai/services.ts     # jarvis, noteSummary, quizGeneration, interviewFeedback, assignmentAnalysis, careerRecommendation, resume, coverLetter
    routes/*.ts        # controllers per domain
    seed.ts            # idempotent demo seed
server/db/
  migrations/001_initial_schema.sql
  migrate.ts, seed.ts
tests/                 # core.test.ts (unit), api.e2e.test.ts (E2E)
docs/                  # ARCHITECTURE.md, API.md
```

## 5. Database
38 normalised tables with UUID PKs, FKs with deliberate cascade rules, unique constraints and indexes on `user_id`, `email`, `category`, `created_at`, `updated_at`. Core tables: `users, profiles, refresh_tokens, password_reset_tokens, notes, note_tags, jarvis_conversations, jarvis_messages, quizzes, quiz_questions, quiz_options, quiz_attempts, quiz_answers, interview_categories, interview_questions, interview_sessions, interview_answers, schedule_entries, reminders, news, announcements, announcement_reads, placement_stats, career_profiles, career_recommendations, coding_sessions, assignments, assignment_submissions, resume_profiles, resume_versions, cover_letters, resources, forum_categories, forum_posts, forum_comments, forum_reports, notifications, audit_logs`.

## 6. AI Architecture
`Frontend → /api/jarvis/chat → requireUser → Zod → jarvisService (prompt + context) → Gemini (JSON mode) → Zod validation (retry once) → persist → response`. Malformed output or provider errors become friendly `502/503` errors; keys and internals are never exposed. All AI output is labelled in the UI.

## 7. Security
bcrypt hashing · short-lived JWT + rotating hashed refresh tokens · httpOnly/SameSite cookies · `requireUser`/`requireRole` (role re-checked in DB) · user ID always from the verified token, never the body · Zod on every input · Drizzle parameterised queries · rate limiting (global, auth, AI, uploads) · same-origin CSRF check on mutations · security headers (nosniff, referrer, permissions, COOP) · upload type/size/magic-byte validation · no stack traces in responses · audit logging of auth, admin and AI actions · secrets only via env.

## 8. Environment Setup
Copy `.env.example` → `.env`:
```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=15m
GEMINI_API_KEY=<your key>          # required for AI features
GEMINI_MODEL=gemini-2.5-flash      # optional
UPLOAD_MAX_SIZE_MB=10
SEED_ADMIN_EMAIL=admin@collegegear.dev
SEED_ADMIN_PASSWORD=<change me>
JUDGE0_URL=                        # optional sandbox for Java/C/C++
CLIENT_URL=                        # optional extra allowed origins (comma-separated)
```
No secrets are needed on the client — there are no `NEXT_PUBLIC_*` variables.

## 9. Local Installation & Commands
```bash
npm install
npm run db:migrate     # apply server/db/migrations/*.sql   (or: npm run db:push via Drizzle)
npm run db:seed        # demo data + admin account (also auto-runs on first API request)
npm run dev            # http://localhost:3000
npm run build && npm start
```
There is no login. The Admin panel (`/admin`) is open to every visitor; set `ADMIN_PANEL_ENABLED=false` to disable it on a public deployment.

## 10. Testing
```bash
npm test                                         # unit tests (scoring, validation, AI schemas, router, ICS)
E2E_BASE_URL=http://localhost:3000 npm test      # + E2E: auth, authorization, notes/schedule CRUD, quiz scoring, profile, admin 403, isolation
```
Manual checklist: register → login → logout → login → create note → refresh (persists) → ask Jarvis → refresh conversation → take quiz → verify score → create schedule → build resume → admin panel → student hitting `/admin` (403) → mobile layout (320–1440px).

## 11. Deployment
Single deployable Next.js app (frontend + API) — works on Vercel, Render, Railway or Replit with any PostgreSQL (Supabase, Neon, RDS). Set env vars, run `npm run db:migrate`, then `npm run build && npm start`. Health check: `GET /api/health` → `{ "success": true, "message": "COLLEGE GEAR API is running" }`. No localhost URLs are hard-coded; the client uses relative `/api` paths so no CORS configuration is needed for same-origin deployments.

## 12. API Overview
See [`docs/API.md`](docs/API.md). All responses use `{ success: true, data }` or `{ success: false, error: { code, message } }`.

## 13. Known limitations (by design)
- **AI** requires `GEMINI_API_KEY`; without it AI endpoints return `503 AI_NOT_CONFIGURED` and the UI explains this.
- **No accounts** — data is tied to the browser workspace cookie; clearing cookies or switching browsers starts a fresh workspace (use Settings → Export my data).
- **Java/C/C++ execution** requires a Judge0 sandbox (`JUDGE0_URL`); it is disabled otherwise rather than running unsafe code.
- Rate limiting is in-memory per instance (use Redis for multi-instance deployments).

## Screenshots
_Add screenshots of the landing page, Command Center, Jarvis, Quiz, Resume builder and Admin analytics here._

## Demo Video
_Add a link to your demo video here._

## Team
| Name | Role |
|---|---|
| _Member 1_ | _Full-stack_ |
| _Member 2_ | _AI / Backend_ |
| _Member 3_ | _UI / UX_ |

## Future Improvements
Email delivery (reset + reminders), push notifications, Redis rate limiting, streaming AI responses, spaced-repetition flashcards from notes, faculty course spaces, calendar sync (Google/Outlook), RAG over official college documents.
