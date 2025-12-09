# Pathologist User Study - Specification

## Purpose
Capture pathologists' visual search paths on whole slide images (WSIs) under constrained, discrete navigation. Output: interaction logs with exact click coordinates + per-slide diagnosis for weakly-supervised learning.

---

## Scope

### V1 Local Prototype ✅ COMPLETE
Single-user local viewer with DZI tiles, discrete navigation, CSV export.

### V2 Multi-User Hosted 🔄 IN PROGRESS (87.5% Complete)
Multi-user authentication, PostgreSQL backend, admin dashboard with session replay.

---

## Task Status (December 2025)

| Task | Description | Status |
|------|-------------|--------|
| T-0001 | WSI Tiler with alignment | ✅ Complete |
| T-0002 | Viewer with discrete navigation | ✅ Complete |
| T-0003 | Click-to-zoom + logging | ✅ Complete |
| T-0004 | Backend API | ✅ Complete |
| T-0005 | Frontend multi-user | ✅ Complete |
| T-0006 | Admin dashboard | ✅ Complete |
| T-0009 | Data verification scripts | ✅ Complete |
| T-0010 | Session replay viewer | ✅ Complete |
| T-0011 | Offline analysis tools | ⬜ Pending |
| T-0012 | Patch extraction | ⬜ Pending |
| T-0007 | Cloud deployment | ⬜ Pending |
| T-0008 | Production readiness | ⬜ Pending |

---

## Navigation Controls

| Action | Behavior |
|--------|----------|
| Left-click | Centers on exact click position, steps up zoom ladder |
| Right-click | Zooms out one level, keeps current center |
| Arrow buttons | Pan by 0.5× viewport, clamped to bounds |
| Back | Reverses last navigation step |
| Reset | Returns to fit view (entire slide visible) |

**Zoom Ladder:** Fit → 2.5× → 5× → 10× → 20× → 40×

**Disabled:** Keyboard shortcuts, mouse wheel zoom, free pan/drag

---

## Event Schema

```
ts_iso8601, session_id, user_id, slide_id, event, zoom_level, dzi_level,
click_x0, click_y0, center_x0, center_y0, vbx0, vby0, vtx0, vty0,
container_w, container_h, dpr, app_version, label, notes
```

**Event Types:** `app_start`, `slide_load`, `cell_click`, `zoom_step`, `arrow_pan`, `back_step`, `reset`, `label_select`, `slide_next`

**Key Fields:**
- `click_x0`, `click_y0` - Exact click position in level-0 pixels (only for `cell_click`)
- `center_x0`, `center_y0` - Viewport center at time of event
- `vbx0`, `vby0`, `vtx0`, `vty0` - Complete viewport bounds

---

## API Endpoints (V2)

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Clear session cookie
- `GET /api/auth/me` - Get current user info

### Slides
- `GET /api/slides` - List slides with completion status
- `GET /api/slides/:slideId/manifest` - Get slide manifest
- `POST /api/slides/:slideId/start` - Create/resume session

### Events
- `POST /api/sessions/:sessionId/events` - Batch upload events
- `POST /api/sessions/:sessionId/complete` - Mark session complete

### Admin
- `GET /api/admin/users` - List pathologists with stats
- `GET /api/admin/progress` - Overall study progress
- `GET /api/admin/export/csv` - Download all events as CSV
- `GET /api/admin/sessions` - List completed sessions
- `GET /api/admin/sessions/:sessionId/events` - Get session events for replay

---

## Database

4 tables: `users`, `slides`, `sessions`, `events`

Schema defined in `backend/src/db/migrations/001_initial.sql`

---

## User Stories

1. **Tile & Align:** CLI generates DZI tiles with `manifest.json` containing alignment parameters
2. **View & Navigate:** Discrete arrow panning, click-to-zoom ladder, no free pan
3. **Click & Label:** Click centers on position, zoom up ladder, label with Normal/Benign/Malignant
4. **Logging:** All interactions captured with exact coordinates in level-0 space
5. **Authentication:** JWT-based login, role-based access (pathologist vs admin)
6. **Slide Queue:** Deterministic per-user randomization
7. **Session Replay:** Admin can replay any completed session with animations

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Tile loading performance | CloudFront CDN with global edge caching |
| Event data loss | Batch upload every 10 events + auto-flush on beforeunload |
| Database performance | Indexes on foreign keys; batch event inserts |
| Auth security | bcrypt + JWT with 7-day expiry + httpOnly cookies |
