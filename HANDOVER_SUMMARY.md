# Pathologist User Study - Handover Summary

**Last Updated:** December 2025  
**Status:** V2 Core Features Complete (87.5%)

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
| T-0010 | Session replay | ✅ |
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
| Arrow buttons | Pan by 0.5× viewport |
| Back | Reverses last navigation |
| Reset | Returns to fit view |

**Zoom Ladder:** Fit → 2.5× → 5× → 10× → 20× → 40×

**Disabled:** Keyboard shortcuts, mouse wheel, free pan

---

## Event Schema (CSV)

```
ts_iso8601, session_id, user_id, slide_id, event, zoom_level, dzi_level,
click_x0, click_y0, center_x0, center_y0, vbx0, vby0, vtx0, vty0,
container_w, container_h, dpr, app_version, label, notes
```

**Event Types:** `app_start`, `slide_load`, `cell_click`, `zoom_step`, `arrow_pan`, `back_step`, `reset`, `label_select`, `slide_next`

**Note:** Cell indices removed. Click coordinates (`click_x0`, `click_y0`) enable flexible patch extraction.

---

## Key Files

### Frontend
- `src/viewer/main.ts` - Viewer logic, navigation, events
- `src/viewer/SessionManager.ts` - Event buffering
- `src/viewer/SlideQueue.ts` - Slide randomization
- `src/admin/SessionReplay.ts` - Replay viewer

### Backend
- `backend/src/routes/auth.ts` - Authentication
- `backend/src/routes/slides.ts` - Slide/session endpoints
- `backend/src/routes/admin.ts` - Admin endpoints
- `backend/src/db/migrations/` - Database schema

### Scripts
- `scripts/verify-csv.py` - CSV validation
- `scripts/verify-alignment.py` - Coordinate validation
- `scripts/verify-sessions.py` - Session validation

---

## Quick Start

```bash
# Database
docker run --name pathology-db -p 5432:5432 -e POSTGRES_PASSWORD=dev123 -d postgres
docker exec -i pathology-db psql -U postgres < backend/src/db/migrations/001_initial.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f backend/src/db/migrations/002_add_dzi_level_to_events.sql
docker exec -i pathology-db psql -U postgres -d pathology_study -f backend/src/db/migrations/003_add_notes_column.sql

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

## Next Steps

1. **T-0011:** Offline analysis tools (Jupyter, heatmaps)
2. **T-0012:** Patch extraction system
3. **T-0007:** Cloud deployment (S3, Vercel, Railway)
4. **T-0008:** Production readiness

**Estimated remaining:** ~16 hours
