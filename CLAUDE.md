# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pathologist User Study — a web app for capturing pathologist slide-viewing behavior (clicks, pans, zooms) during whole-slide image (WSI) examination. Data trains ML models linking scanning behavior to diagnostic decisions. Built with TypeScript full-stack: Vite + OpenSeadragon frontend, Express + PostgreSQL backend.

## Build & Run Commands

### Frontend (root directory)
```bash
npm install
npm run dev          # Vite dev server on :5173
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build
```

### Backend (backend/ directory)
```bash
cd backend
npm install
npm run dev          # nodemon + ts-node on :3001
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled JS from dist/
```

Both must run simultaneously for local development. No automated test suite exists.

### Database
Migrations run manually in order against PostgreSQL:
```
backend/src/db/migrations/001_initial.sql          # Core tables
backend/src/db/migrations/002_add_dzi_level_to_events.sql
backend/src/db/migrations/003_add_notes_column.sql
backend/src/db/migrations/004_add_viewing_attempt.sql
backend/src/db/migrations/005_fix_viewing_attempt_race_condition.sql
```
Migrations are immutable — never modify existing ones, only add new numbered files.

### Scripts
```bash
cd backend
npx ts-node scripts/create-test-users.ts           # Creates admin/admin123, pathologist1/patho1, pathologist2/patho2
npx ts-node scripts/create-users-bulk.ts users.csv  # Bulk create from CSV (username,password)
npx ts-node scripts/seed-slides.ts                  # Load slide manifests
```

## Architecture

### Two Independent Apps
- **Frontend** (`/src`, `/index.html`, `/vite.config.ts`, root `package.json`): Vanilla TypeScript + OpenSeadragon, bundled by Vite. No framework.
- **Backend** (`/backend`): Express 5 REST API, separate `package.json` and `tsconfig.json`. ES modules throughout (`"type": "module"`).

### Frontend Key Modules
- `src/viewer/main.ts` — Core application: auth flow, OpenSeadragon viewer init, event logging (click/zoom/pan), zoom history, diagnosis selection, admin routing
- `src/viewer/SessionManager.ts` — Buffers events in memory (batch size 10), auto-uploads when full, flushes on session complete
- `src/viewer/SlideQueue.ts` — Loads slides from API, deterministic shuffle seeded by user ID, skips completed slides
- `src/viewer/api.ts` — Fetch wrapper with 3-attempt retry and exponential backoff (1s/2s/4s)
- `src/viewer/types.ts` — All shared TypeScript interfaces
- `src/viewer/fit.ts` — Magnification calculations (2.5x/5x/10x/20x/40x ladder)
- `src/admin/dashboard.ts` — Admin stats, user table, CSV export
- `src/admin/SessionReplay.ts` — Playback of recorded sessions with canvas overlay

### Backend Key Modules
- `backend/src/index.ts` — Express server, middleware setup, route mounting
- `backend/src/db/index.ts` — PostgreSQL connection pool (pg, max 20 clients)
- `backend/src/middleware/auth.ts` — JWT verification + role-based access (pathologist/admin)
- `backend/src/middleware/rateLimiter.ts` — Rate limiting (5/min auth, 100/min API)
- `backend/src/routes/auth.ts` — Login/logout/me endpoints, bcrypt + JWT (7-day, httpOnly cookie)
- `backend/src/routes/slides.ts` — Slide listing, manifest retrieval, session creation
- `backend/src/routes/admin.ts` — User management, progress stats, CSV export, session replay data

### Database Schema (4 tables)
- `users` — UUID PK, username (unique), password_hash, role ('pathologist'|'admin')
- `slides` — UUID PK, slide_id (unique), s3_key_prefix, manifest_json (JSONB)
- `sessions` — UUID PK, user_id FK, slide_id FK, label, current_attempt, last_started_at; UNIQUE(user_id, slide_id)
- `events` — UUID PK, session_id FK, ts_iso8601, event type, coordinates, viewport state, dzi_level, viewing_attempt

### API Routes
- `POST /api/auth/login|logout`, `GET /api/auth/me`
- `GET /api/slides`, `GET /api/slides/:slideId/manifest`, `POST /api/slides/:slideId/start`
- `POST /api/sessions/:sessionId/events` (batch upload), `POST /api/sessions/:sessionId/complete`
- `GET /api/admin/users|progress`, `POST /api/admin/users`, `GET /api/admin/export/csv`, `GET /api/admin/sessions/:userId`, `GET /api/admin/sessions/:sessionId/events`

## Key Domain Concepts

**Coordinate system**: All coordinates stored in level-0 (full resolution) pixel space. DZI level is the DeepZoom pyramid level (0=lowest res). Magnification ladder: 2.5x, 5x, 10x, 20x, 40x. "Fit mode" is a special state (entire slide visible).

**Navigation**: No free pan — arrow buttons move by 0.5x viewport. Left-click centers on exact click position and zooms in. Right-click zooms out keeping center. No keyboard shortcuts or mouse wheel zoom (D-0015).

**Viewing attempts**: When a user re-opens a completed slide, `current_attempt` increments. Detection uses `last_started_at` timestamp with 60-second threshold (not event count) to avoid race conditions with buffered uploads (D-0021).

**Deterministic slide order**: Slide queue is shuffled using user ID as PRNG seed (D-0012).

## Environment Variables

Frontend `.env`: `VITE_API_URL=http://localhost:3001`

Backend `.env`: `DATABASE_URL`, `JWT_SECRET`, `PORT` (3001), `NODE_ENV`, `FRONTEND_URL` (for CORS)

## Conventions

- Tagged logging: `[API]`, `[AUTH]`, `[DB]`, `[Admin]`, `[SessionManager]`, `[SlideQueue]`, `[Dashboard]`, `[Viewer]`
- Auth: bcrypt 10 rounds, JWT 7-day expiry, httpOnly SameSite=lax cookies, secure in production
- Production deployment: Vercel (frontend) + Railway/Render (backend + PostgreSQL) + S3/CloudFront (DZI tiles)
- Architectural decisions documented in `project_state/decisions.md` (D-0001 through D-0021)
