# Pathologist User Study - Handover Summary

**Last Updated:** December 2024  
**Status:** V2 Core Features Complete (87.5%)  
**Last Session:** Data integrity fixes - actual DZI level capture + viewing attempt tracking

---

## ✅ Data Integrity Fixes (This Session)

### Fix 1: Actual DZI Level Capture for Fit-to-Screen

**Problem:** When "fit to screen", we captured placeholder values (2.5×, DZI 14) instead of the actual rendered level.

**Solution:** Added `getActualDziLevel()` function that calculates the real DZI level from OpenSeadragon's current zoom:
```typescript
// Formula: DZI level = maxLevel + log2(imageZoom)
const imageZoom = tiledImage.viewportToImageZoom(viewportZoom);
const rawLevel = maxLevel + Math.log2(imageZoom);
const dziLevel = Math.round(rawLevel);  // Clamped to valid range
```

Now ALL events capture the actual DZI level being rendered, not placeholders.

### Fix 2: Viewing Attempt Tracking

**Problem:** If user logs out and back in, all events merged into same session with no way to differentiate.

**Solution:** Added `viewing_attempt` field:
- Sessions table: `current_attempt` counter
- Events table: `viewing_attempt` field (1 = first, 2+ = resumed)
- When user starts session with existing events, attempt increments
- CSV export includes `viewing_attempt` column

**Database Migration:** `backend/src/db/migrations/004_add_viewing_attempt.sql`

### Files Changed
- `src/viewer/main.ts` - Added `getActualDziLevel()`, `getMagnificationFromDziLevel()`, updated `updateViewerState()`
- `src/viewer/types.ts` - Added `viewing_attempt` to `LogEvent` and `ReplayEvent`
- `src/viewer/SessionManager.ts` - Added `viewingAttempt` tracking
- `src/viewer/api.ts` - Updated `startSession()` return type
- `backend/src/routes/slides.ts` - Increment attempt on resume with existing events
- `backend/src/routes/admin.ts` - Include `viewing_attempt` in CSV export and replay events

---

## Remaining Data Integrity Notes

### Session Replay Still Makes Some Inferences
- Calls `goHome()` for fit events instead of using captured viewport bounds
- Uses `isClickAfterFitEvent()` to detect clicks at fit level

### What IS Captured Correctly
| Data | Status |
|------|--------|
| Click positions (`click_x0`, `click_y0`) | ✅ Level-0 coords |
| Viewport bounds (`vbx0`, `vby0`, `vtx0`, `vty0`) | ✅ All events |
| Viewport center (`center_x0`, `center_y0`) | ✅ Correct |
| DZI level (`dzi_level`) | ✅ **NOW FIXED** - actual rendered level |
| Zoom level (`zoom_level`) | ✅ **NOW FIXED** - calculated from DZI level |
| Viewing attempt (`viewing_attempt`) | ✅ **NEW** - differentiates login sessions |
| Timestamps | ✅ ISO 8601 |
| Event types | ✅ Correct |

---

## Project Overview

Web-based whole slide image (WSI) viewer for a pathologist user study. Captures detailed interaction data (pan, zoom, clicks) to train ML models linking scanning behavior to diagnostic decisions.

### Architecture
- **Frontend:** TypeScript + OpenSeadragon + Vite
- **Backend:** Node.js + Express + PostgreSQL + JWT
- **Admin:** Role-based dashboard with session replay
- **Tiles:** DeepZoom Image (DZI) format, 512×512 tiles

---

## Task Status

| Task | Description | Status |
|------|-------------|--------|
| T-0001 | WSI Tiler with alignment | ✅ |
| T-0002 | Discrete navigation viewer | ✅ |
| T-0003 | Click-to-zoom + logging | ✅ |
| T-0004 | Backend API | ✅ |
| T-0005 | Multi-user frontend | ✅ |
| T-0006 | Admin dashboard | ✅ |
| T-0009 | Verification scripts | ✅ |
| T-0010 | Session replay | ✅ (with caveats above) |
| T-0011 | Analysis tools | ⬜ |
| T-0012 | Patch extraction | ⬜ |
| T-0007 | Cloud deployment | ⬜ |
| T-0008 | Production readiness | ⬜ |

---

## Navigation Controls

| Action | Behavior |
|--------|----------|
| Left-click | Centers on click, steps up zoom ladder |
| Right-click | Zooms out one level, keeps center |
| Arrow buttons | Pan by 0.4× viewport |
| Back | Reverses last navigation |
| Reset | Returns to fit view |

**Zoom Ladder:** Fit → 2.5× → 5× → 10× → 20× → 40×

**Disabled:** Keyboard shortcuts, mouse wheel, free pan

---

## Event Schema (CSV)

```
ts_iso8601, session_id, user_id, slide_id, event, zoom_level, dzi_level,
click_x0, click_y0, center_x0, center_y0, vbx0, vby0, vtx0, vty0,
container_w, container_h, dpr, app_version, label, notes, viewing_attempt
```

**Event Types:** `app_start`, `slide_load`, `cell_click`, `zoom_step`, `arrow_pan`, `back_step`, `reset`, `label_select`, `slide_next`

**New Field:** `viewing_attempt` - Integer (1 = first viewing, 2+ = subsequent viewings after logout/login)

---

## Key Files

### Frontend
- `src/viewer/main.ts` - Viewer logic, navigation, events
- `src/viewer/SessionManager.ts` - Event buffering
- `src/viewer/SlideQueue.ts` - Slide randomization
- `src/admin/SessionReplay.ts` - Replay viewer (updated this session)

### Backend
- `backend/src/routes/auth.ts` - Authentication
- `backend/src/routes/slides.ts` - Slide/session endpoints
- `backend/src/routes/admin.ts` - Admin endpoints
- `backend/src/db/migrations/` - Database schema

---

## Quick Start

```bash
# Database
docker run --name pathology-postgres -p 5432:5432 -e POSTGRES_PASSWORD=dev123 -d postgres
docker exec -i pathology-postgres psql -U postgres < backend/src/db/migrations/001_initial.sql
docker exec -i pathology-postgres psql -U postgres -d pathology_study -f backend/src/db/migrations/002_add_dzi_level_to_events.sql
docker exec -i pathology-postgres psql -U postgres -d pathology_study -f backend/src/db/migrations/003_add_notes_column.sql
docker exec -i pathology-postgres psql -U postgres -d pathology_study -f backend/src/db/migrations/004_add_viewing_attempt.sql

# Backend (terminal 1)
cd backend && npm install && npm run dev

# Frontend (terminal 2)
npm install && npm run dev
```

### Test Credentials
| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| pathologist1 | patho123 | pathologist |
| pathologist2 | patho123 | pathologist |

---

## Potential Next Actions (User to Decide)

1. ~~**Fix fit-to-screen data capture**~~ ✅ DONE - Actual DZI level now captured
2. ~~**Session separation**~~ ✅ DONE - `viewing_attempt` tracks separate login sessions
3. **Make replay 100% data-driven** - Use captured viewport bounds instead of `goHome()` inference
4. **Enable incomplete session replay** - Allow admins to view partial sessions
5. **Continue with remaining tasks** (T-0007, T-0008, T-0011, T-0012)

**Estimated remaining for core tasks:** ~15 hours
