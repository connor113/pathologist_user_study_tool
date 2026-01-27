# Pathologist User Study - Handover for T-0008

**Date:** January 24, 2026  
**Current Status:** Ready for T-0008 (Production Readiness)  
**Completion:** 66.7% (8 of 12 tasks complete, 2 remaining for launch)

---

## Quick Context

Web-based whole slide image (WSI) viewer for pathologist user studies. Captures detailed interaction data (clicks, pans, zooms) to train ML models linking scanning behavior to diagnostic decisions.

**Architecture:**
- Frontend: TypeScript + Vite + OpenSeadragon
- Backend: Node.js + Express + PostgreSQL + JWT
- Tiles: DeepZoom Image (DZI) format, 512×512 JPEG

---

## Recent Session Summary

### ✅ Completed This Session

1. **Committed Data Integrity Fixes** (Commits: a21bb35, 3bf4c97)
   - Fixed actual DZI level capture (no more placeholder values for fit-to-screen)
   - Added viewing attempt tracking (differentiate multiple login sessions)
   - Migration 004: Added `viewing_attempt` to sessions and events tables
   - Updated README with migration 004

2. **Fixed Critical Bug** (Commit: d32bd1f)
   - **Bug:** Viewing attempt only incremented if events existed in database
   - **Problem:** Events are buffered (batch of 10) and may not upload before browser close
   - **Fix:** Added `last_started_at` timestamp, use 60-second threshold for new attempts
   - Migration 005: Fixed race condition with time-based detection
   - See `BUG_FIX_005.md` for full details

3. **Removed Deferred Tasks**
   - Deleted T-0011 (offline analysis tools) - post-deployment work
   - Deleted T-0012 (patch extraction) - ML pipeline work separate from hosting

---

## Current Git Status

```
Branch: main (4 commits ahead of origin/main)
Working directory: clean

Recent commits:
d32bd1f fix: viewing_attempt race condition - use timestamp not event count
3bf4c97 docs: update backend README with migration 004
a21bb35 feat: fix data integrity - actual DZI level capture + viewing attempt tracking
c662b4b feat: enhance session replay visualization with segmented click paths
```

---

## Completed Tasks (8/12)

| Task | Status | Description |
|------|--------|-------------|
| T-0001 | ✅ | WSI tiling with alignment verification |
| T-0002 | ✅ | Discrete navigation viewer |
| T-0003 | ✅ | Click-to-zoom + logging |
| T-0004 | ✅ | Backend API with PostgreSQL |
| T-0005 | ✅ | Multi-user frontend with auth |
| T-0006 | ✅ | Admin dashboard |
| T-0009 | ✅ | Data verification scripts |
| T-0010 | ✅ | Session replay viewer |

---

## Remaining Tasks for Launch (2)

### 🔴 **Next: T-0008 - Production Readiness** (~3 hours)

**Goal:** Add production-grade features before deployment.

**Required Deliverables:**
1. **Error Handling**
   - User-friendly error messages (no stack traces in production)
   - Network failure handling with retry logic
   - Form validation feedback

2. **Loading States**
   - Spinners during API calls (login, slide load, event upload)
   - Disable buttons during submission
   - Progress indicators for long operations

3. **Rate Limiting**
   - `backend/src/middleware/rateLimiter.ts`
   - Limit auth endpoints: 5 login attempts per minute per IP
   - Prevent brute force attacks

4. **Retry Logic for Events**
   - Exponential backoff for event upload failures
   - 3 retry attempts before showing error
   - Preserve events in memory if upload fails

5. **User Documentation**
   - `docs/USER_GUIDE.md` - Pathologist instructions
   - `docs/ADMIN_GUIDE.md` - Admin instructions
   - Include navigation controls, workflow, troubleshooting

6. **Utility Scripts**
   - `backend/scripts/create-users.js` - Bulk user creation from CSV
   - Update with production usage examples

**Key Files to Modify:**
- `src/viewer/main.ts` - Add loading states, error handling
- `src/viewer/api.ts` - Add retry logic
- `backend/src/middleware/rateLimiter.ts` - NEW
- `backend/src/index.ts` - Apply rate limiting
- `docs/USER_GUIDE.md` - NEW
- `docs/ADMIN_GUIDE.md` - NEW

**Acceptance Criteria:**
- [ ] Loading spinners visible during API operations
- [ ] Errors display user-friendly messages
- [ ] Rate limiting blocks excessive login attempts
- [ ] Event upload retries 3 times with exponential backoff
- [ ] User and admin guides complete and clear
- [ ] Bulk user creation script tested

### 🔴 **Then: T-0007 - Cloud Deployment** (~4 hours)

Deploy to production infrastructure (AWS S3 + CloudFront + Railway + Vercel).

**Note:** Comprehensive deployment guide already exists at [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Database Schema (Current)

**5 migrations applied:**
1. `001_initial.sql` - Core schema (users, slides, sessions, events)
2. `002_add_dzi_level_to_events.sql` - DZI level tracking
3. `003_add_notes_column.sql` - Notes field for sessions
4. `004_add_viewing_attempt.sql` - Viewing attempt tracking
5. `005_fix_viewing_attempt_race_condition.sql` - Time-based attempt detection

**Sessions table fields:**
- `id`, `user_id`, `slide_id`, `created_at`, `completed_at`, `label`, `notes`
- `current_attempt` (integer, default 1)
- `last_started_at` (timestamp, tracks session starts)

**Events table fields:**
- `id`, `session_id`, `ts_iso8601`, `event`, `zoom_level`, `dzi_level`
- `click_x0`, `click_y0`, `center_x0`, `center_y0`
- `vbx0`, `vby0`, `vtx0`, `vty0` (viewport bounds)
- `container_w`, `container_h`, `dpr`, `app_version`
- `label`, `notes`, `viewing_attempt` (integer, default 1)

---

## Key Project Decisions

See [`project_state/decisions.md`](project_state/decisions.md) for all 21 decisions.

**Recent additions:**
- **D-0021:** Viewing attempt detection uses 60-second timestamp threshold, not event count (fixes race condition)

---

## Important Implementation Details

### Event Batching
- Frontend buffers events in memory (batch of 10)
- Auto-uploads every 10 events
- Auto-flushes on `beforeunload` (page close/refresh)
- Uploads on slide completion

### Viewing Attempt Logic
- New session: `current_attempt = 1`, `last_started_at = NOW()`
- Resume session:
  - If `last_started_at` > 60 seconds ago → increment attempt
  - If < 60 seconds → same attempt (page refresh)
  - Always update `last_started_at = NOW()`

### Navigation System
- **Zoom Ladder:** Fit → 2.5× → 5× → 10× → 20× → 40×
- **Controls:** Left-click zooms in, right-click zooms out, arrow buttons pan
- **Disabled:** Keyboard shortcuts, mouse wheel, free pan/drag

---

## Local Development Setup

```bash
# Database (Docker)
docker run --name pathology-db -p 5432:5432 -e POSTGRES_PASSWORD=dev123 -d postgres

# Run all migrations
docker exec -i pathology-db psql -U postgres < backend/src/db/migrations/001_initial.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f backend/src/db/migrations/002_add_dzi_level_to_events.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f backend/src/db/migrations/003_add_notes_column.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f backend/src/db/migrations/004_add_viewing_attempt.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f backend/src/db/migrations/005_fix_viewing_attempt_race_condition.sql

# Backend (terminal 1)
cd backend && npm install && npm run dev

# Frontend (terminal 2)
npm install && npm run dev
```

**Test Credentials:**
- Admin: `admin` / `admin123`
- Pathologist: `pathologist1` / `patho123`

---

## Starting T-0008: Next Steps

1. **Read task file:** [`tasks/T-0008.md`](tasks/T-0008.md)
2. **Review current code:**
   - `src/viewer/main.ts` - Main viewer (needs loading states)
   - `src/viewer/api.ts` - API client (needs retry logic)
   - `backend/src/index.ts` - Express server (needs rate limiting)
3. **Create plan** following project conventions (see [`project_state/instructions.md`](project_state/instructions.md))
4. **Implement incrementally** with tests after each step
5. **Update documentation** as you add features

---

## Reference Documents

- **Spec:** [`project_state/spec.md`](project_state/spec.md)
- **Decisions:** [`project_state/decisions.md`](project_state/decisions.md)
- **Progress:** [`project_state/progress.md`](project_state/progress.md)
- **Test Plan:** [`project_state/test_plan.md`](project_state/test_plan.md)
- **Bug Fix 005:** [`BUG_FIX_005.md`](BUG_FIX_005.md)
- **Deployment Guide:** [`DEPLOYMENT.md`](DEPLOYMENT.md)

---

## Data Integrity Status ✅

| Data Field | Status |
|------------|--------|
| `dzi_level` at all zoom levels | ✅ Actual rendered level (fixed) |
| `zoom_level` at all zoom levels | ✅ Calculated from DZI level (fixed) |
| `viewing_attempt` tracking | ✅ Time-based detection (race condition fixed) |
| Click coordinates (`click_x0`, `click_y0`) | ✅ Level-0 space |
| Viewport bounds (`vbx0`, `vby0`, `vtx0`, `vty0`) | ✅ Level-0 space |
| Timestamps | ✅ ISO 8601 format |
| All event types | ✅ Correctly logged |

**Ready for production data collection!** 🚀

---

## Success Criteria for T-0008

- [ ] Loading spinners implemented and visible
- [ ] Error messages are user-friendly (no technical jargon)
- [ ] Rate limiting active on `/api/auth/login` (5 req/min/IP)
- [ ] Event upload retry logic working (3 attempts, exponential backoff)
- [ ] USER_GUIDE.md complete with screenshots/examples
- [ ] ADMIN_GUIDE.md complete with workflow instructions
- [ ] Bulk user creation script tested with sample CSV
- [ ] All changes tested locally
- [ ] No regressions in existing functionality

---

**Ready to begin T-0008 in fresh chat session!**
