# spec.md

## Purpose & value
Capture pathologists’ visual search paths on WSIs under a constrained, grid‑guided zoom ladder so we can learn which regions are considered decision‑relevant and align these behaviors with model patches for WSL/MIL. Output: interaction logs + per‑slide label for a fixed test subset.

## Scope (V1 Local Prototype) - COMPLETED
**In:** Precompute tiles from SVS/NDPI/TIFF; ensure **exact grid↔model patch alignment** at tiling time; local viewer loads DZI, shows fixed zoom ladder **2.5×→5×→10×→20×→40×** with a **zoom‑level‑fixed grid** (cells = patch_px × patch_px at each zoom, computed internally without visual overlay); click‑to‑center step zoom; **discrete arrow panning** (no free pan); CSV export of logs. Single user, single machine.
**Out:** Auth, multi‑user sessions, remote deploy, overlays/heatmaps, consent, dashboards, telemetry, randomization.

## Scope (V2 Multi-User Hosted) - IN PROGRESS
**In:** Username/password authentication; PostgreSQL database (users, slides, sessions, events); Express REST API; slide queue with deterministic per-user randomization; batch event upload to backend; admin dashboard (completion stats, CSV export); S3 + CloudFront tile storage; Vercel frontend deployment; Railway/Render backend deployment; support 5-10 pathologists reviewing 100-200 slides over study period.

**Out (deferred to V3+):** Real-time collaboration; slide annotations/markup; inter-rater reliability UI; consent flow; randomized A/B testing; mobile app; heatmap overlays; advanced analytics dashboard; slide upload UI (admin uses script); user profile management; forgot-password flow; audit logs beyond events; mid-slide session resume (viewport state persistence).

**Status (2025-11-18):**
- ✅ **T-0004 Complete**: Backend API fully implemented (auth, slides, sessions, admin endpoints)
- ✅ **T-0005 Complete**: Frontend multi-user refactor (login, slide queue, batching, notes + buffering fixes)
- ✅ **T-0006 Complete**: Admin dashboard UI (role-based routing, stats display, user table, CSV export)
- ✅ **T-0009 Complete**: Data verification scripts (CSV validation, alignment checks, session completeness)
- ✅ **T-0010 Complete**: Admin session replay viewer (full-page viewer, smooth animations, playback controls)
- ⬜ **T-0011 Pending**: Offline analysis tools (Jupyter notebooks, heatmaps, scanning path visualizations)
- ⬜ **T-0012 Pending**: Patch extraction system (extract patches from DZI using click coordinates)
- ⬜ **T-0007 Pending**: Cloud deployment (S3, CloudFront, Vercel, Railway/Render)
- ⬜ **T-0008 Pending**: Production readiness (error handling, seeding, testing)

## User stories & AC
1) **Tile & align**  
*As a researcher*, I can run a CLI on an SVS to generate a DZI pyramid **and a manifest** that locks alignment parameters.
- **AC:** Writes tiles and `manifest.json` with: `slide_id, level0_width, level0_height, mpp0, patch_px∈{256,512}, tile_size, overlap=0, anchor=(0,0)`. 
- **AC:** A bundled **alignment check** verifies lattice math correctness: for multiple sampled positions at level‑0, confirms `indexOf(center(i,j)) == (i,j)`. Outputs `alignment_ok=true`.

2) **View & navigate**  
*As a researcher*, I can open the viewer with **arrow buttons** (↑,↓,←,→) to pan by **½ viewport** in that direction; edges clamp.
- **AC:** Ladder options fixed to {2.5×,5×,10×,20×,40×}; starting level = 5× if entire slide fits at 5×, else 2.5×. 
- **AC:** **No free pan**; wheel zoom disabled; keyboard shortcuts disabled. Arrow pan steps the view by 0.5× current viewport (world coords), clamped to slide bounds; events are logged.
- **AC:** Right-click zooms out one level while keeping current center (no recenter); default right-click menu is blocked. 

3) **Click→center→step & label**  
*As a researcher*, I can click on the slide to center the view on the exact click position and step one zoom level (2.5→5→10→20→40); at 40× (max zoom) clicking does nothing; I can **Back one level** or **Reset to start**; I can choose **Normal / Benign lesion / Malignant** at any time and **Confirm & Next**.
- **AC:** Click centers on exact click position (not cell center). Back pops one step; Reset returns to fit view (entire slide visible). 
- **AC:** Notes typed in the sidebar are captured when **Confirm & Next** is pressed and stored with the `slide_next` event (`notes` column in CSV/backend).
- **AC:** Magnification level is displayed in sidebar ("Fit to screen" when zoomed out, "X×" when at specific magnification).

4) **Logging & export**  
*As a researcher*, I can download a CSV of interactions for a session.
- **AC:** CSV columns (see below) with rows for discrete events (each event includes **viewport bounds in level‑0** at time of event).

---

### V2 User Stories (Multi-User Hosted)

5) **Authentication**  
*As a pathologist*, I can log in with my username and password to access my personalized slide queue.
- **AC:** Login page with username/password fields; JWT token stored in httpOnly cookie; invalid credentials show error message; successful login redirects to viewer.
- **AC:** Logout button clears session and returns to login page.

6) **Slide queue**  
*As a pathologist*, I see a randomized list of all study slides (different order than other users) and can progress through them sequentially.
- **AC:** After login, first slide loads automatically; progress indicator shows "Slide X of 200"; slide order is consistent across sessions (deterministic shuffle using user_id as seed).
- **AC:** "Confirm & Next" button uploads events, marks session complete with label, and loads next slide; completed slides tracked per user.
- **Implementation note:** Backend returns slides in upload order; frontend implements deterministic shuffle using user_id as PRNG seed (per D-0012). This ensures each user sees all slides but in different order, and order remains consistent across sessions.

7) **Session persistence**  
*As a pathologist*, my interactions are automatically saved so I don't lose progress if I close the browser.
- **AC:** Events uploaded to backend periodically (every 10 events) and on slide completion; session created when slide starts; session marked complete with label when "Confirm & Next" clicked.
- **AC:** Can resume study at next incomplete slide (no mid-slide resume in V2).

8) **Admin dashboard**  
*As a researcher*, I can monitor study progress and download all interaction data.
- **AC:** Admin login gives access to dashboard showing: list of pathologists, completion count per user (e.g., "45/200"), overall progress (e.g., "850/1000 total sessions").
- **AC:** "Download CSV" button generates CSV with all events from all users/sessions; CSV format matches V1 schema plus user_id.
- **AC:** Dashboard updates on page refresh (no real-time updates needed).

9) **Cloud tile delivery**  
*As a pathologist*, slides load instantly without delays, regardless of my location.
- **AC:** Tiles served from CloudFront CDN; tile requests return within <500ms globally; no visible loading lag when panning or zooming.
- **AC:** Manifest loaded from backend API; tiles loaded from CDN URL specified in environment variable.

## Non‑functionals
- **Alignment correctness > performance.** Single source of truth = level‑0 lattice anchored at (0,0).
- Grid is **zoom‑level‑fixed** (independent of tiles); each cell represents patch_px × patch_px pixels at the current zoom level. Tile boundaries never influence cell math.
- Deterministic behavior; logs are append‑only; CSV export idempotent.

## Interfaces & data
### Levels & fitting
- Ladder: 2.5×, 5×, 10×, 20×, 40× (assume 40× ≈ native). 
- `downsample(level) = 40 / level_mag`. 
- **Start level:** 5× if entire slide fits at 5×, else 2.5×. Arrow panning available at all levels.

### Patch Extraction (from Click Coordinates)
- Click coordinates (`click_x0`, `click_y0`) are logged in level-0 pixel space for `cell_click` events.
- Patch extraction can use any size centered on the click point.
- Slide metadata (patch_px, tile_size, alignment_ok) is available from the manifest when needed.
- **Note:** Cell indices (i, j) have been removed from event logging. Exact click coordinates provide all needed information for flexible patch extraction.

### Navigation
- **Click:** Centers viewport on exact click position; if not at max zoom, steps up one level (2.5→5→10→20→40). At 40×, clicking does nothing.
- **Right-click:** Zooms out one level while keeping current center (no recenter). Default right-click menu is blocked.
- **Arrows:** Translate viewport center by ±0.5× viewport width/height in level‑0, clamped. 
- **Back:** Pops one step from zoom history (reverses last click or right-click).
- **Reset:** Returns to fit view (entire slide visible).
- **Note:** Keyboard shortcuts (WASD, arrow keys) and mouse wheel zoom are disabled.

### Event schema (CSV)
`ts_iso8601, session_id, user_id, slide_id, event, zoom_level, dzi_level, click_x0, click_y0, center_x0, center_y0, vbx0, vby0, vtx0, vty0, container_w, container_h, dpr, app_version, label, notes`
- **event ∈** {`app_start`,`slide_load`,`cell_click`,`zoom_step`,`arrow_pan`,`back_step`,`reset`,`label_select`,`slide_next`}
- **Click coordinates (level-0):** For `cell_click` events only: `click_x0, click_y0` are the exact coordinates where the user clicked (not cell indices).
- **Viewport bounds (level‑0):** Every event includes bottom‑left `(vbx0,vby0)` and top‑right `(vtx0,vty0)` of the current view at time of event.
- **notes:** UTF-8 string captured from the sidebar when the user confirms a label (empty string stored as null).

**Note:** Cell indices (i, j) have been removed. We now track exact click coordinates which allows extraction of any size patches centered on the click point. Slide metadata (patch_px, tile_size, alignment_ok) is available from the manifest when needed.

---

### V2 API Endpoints

**Authentication:**
- `POST /api/auth/login` - Body: `{username, password}` → Response: `{data: {user: {id, username, role}}}` + httpOnly cookie
- `POST /api/auth/logout` - Clear session cookie → Response: `{data: {success: true}}`
- `GET /api/auth/me` - Get current user → Response: `{data: {user: {...}}}` or 401 if not authenticated

**Slides:**
- `GET /api/slides` - List slides for current user with completion status → Response: `{data: {slides: [{id, slide_id, completed: boolean}, ...], total: 200, completed: 45}}`
- `GET /api/slides/:slideId/manifest` - Get manifest JSON → Response: `{data: {manifest: {...}}}`
- `GET /api/slides/:slideId/start` - Create new session → Response: `{data: {session_id: "uuid"}}`

**Events:**
- `POST /api/sessions/:sessionId/events` - Batch upload events → Body: `{events: [LogEvent, ...]}` → Response: `{data: {inserted: 10}}`
- `POST /api/sessions/:sessionId/complete` - Mark session complete → Body: `{label: "normal"|"benign"|"malignant"}` → Response: `{data: {session: {...}}}`

**Admin:**
- `GET /api/admin/users` - List pathologists → Response: `{data: {users: [{id, username, total_sessions, completed_sessions}, ...]}}`
- `GET /api/admin/progress` - Overall stats → Response: `{data: {total_pathologists: 5, total_slides: 200, total_sessions: 1000, completed_sessions: 450}}`
- `POST /api/admin/users` - Create pathologist → Body: `{username, password}` → Response: `{data: {user: {...}}}`
- `GET /api/admin/export/csv` - Download all events as CSV → Response: CSV file download
- `GET /api/admin/sessions` - List completed sessions (optional `?user_id=uuid` filter) → Response: `{data: {sessions: [{id, user_id, username, slide_id, slide_name, started_at, completed_at, label, event_count}, ...]}}`
- `GET /api/admin/sessions/:sessionId/events` - Get all events for a session → Response: `{data: {session: {...}, events: [ReplayEvent, ...]}}`

**Database Schema (PostgreSQL):**

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('pathologist', 'admin')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Slides table
CREATE TABLE slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id VARCHAR(255) UNIQUE NOT NULL,
  s3_key_prefix VARCHAR(500) NOT NULL,
  manifest_json JSONB NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  label VARCHAR(50) CHECK (label IN ('normal', 'benign', 'malignant')),
  UNIQUE(user_id, slide_id)  -- One session per user per slide
);

-- Events table (all coordinates in level-0 pixel space)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts_iso8601 TIMESTAMPTZ NOT NULL,
  event VARCHAR(50) NOT NULL,
  zoom_level NUMERIC,           -- Magnification (2.5, 5, 10, 20, 40)
  dzi_level INTEGER,            -- DZI pyramid level
  click_x0 NUMERIC,             -- Exact click X (only for cell_click)
  click_y0 NUMERIC,             -- Exact click Y (only for cell_click)
  center_x0 NUMERIC,            -- Viewport center X
  center_y0 NUMERIC,            -- Viewport center Y
  vbx0 NUMERIC,                 -- Viewport bottom-left X
  vby0 NUMERIC,                 -- Viewport bottom-left Y
  vtx0 NUMERIC,                 -- Viewport top-right X
  vty0 NUMERIC,                 -- Viewport top-right Y
  container_w INTEGER,          -- Browser container width
  container_h INTEGER,          -- Browser container height
  dpr NUMERIC,                  -- Device pixel ratio
  app_version VARCHAR(50),
  label VARCHAR(50),
  notes TEXT
);

-- Indexes for common queries
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_slide_id ON sessions(slide_id);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_dzi_level ON events(dzi_level);
```

## Risks & mitigations

### V1 Risks (Addressed)
- **Misalignment** → baked manifest with lattice params + alignment check; unit tests on lattice; logged viewport bounds for verification.
- **Tiles vs lattice mismatch** → grid math independent of tile grid; all math in level‑0.
- **Very large slides won't fit even at 2.5×** → discrete arrow panning available at all levels.

### V2 Risks (Active)
- **Tile loading performance** → CloudFront CDN with global edge caching; S3 bucket in same region as most users; measure p95 tile load latency < 500ms.
- **Event data loss** → Batch upload every 10 events, auto-flush every 5s, send buffered data on `beforeunload`/`visibilitychange`, and flush remaining events before marking a session complete.
- **Database performance at scale** → Indexes on foreign keys; batch insert events (single transaction); monitor query times; PostgreSQL handles 10 users × 200 slides × ~100 events/slide = ~200k rows easily.
- **Cost overruns** → Monitor AWS billing alerts; CloudFront has free tier (1TB/month); S3 costs ~$0.023/GB; estimate 200 slides × 5GB avg = $23/month storage + CDN.
- **Auth security** → bcrypt with salt rounds=10; JWT tokens expire after 7 days; httpOnly cookies prevent XSS; HTTPS only in production.
- **User error (lost passwords)** → Admin can reset passwords via direct database update; no self-service password reset in V2 (deferred to V3).
- **Concurrent sessions (same user, multiple tabs)** → Not explicitly prevented; events upload to same session; may cause confusion but won't corrupt data; document as "single tab only" in instructions.

## Milestones

### V1 (Completed)
M1 tiler & manifest with alignment check → M2 viewer loads slide + start level + arrows → M3 click/zoom ladder + logging + CSV + labels.

### V2 (In Progress)
M4 Backend API + database schema + local testing → M5 Frontend auth + slide queue + event upload → M6 Admin dashboard → M7 Cloud deployment (S3 + Vercel + Railway/Render) → M8 Production readiness (error handling + testing).

**Deployment Details:** See `DEPLOYMENT.md` for step-by-step instructions on deploying to production.