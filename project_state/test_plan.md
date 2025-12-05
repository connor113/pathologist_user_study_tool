# test_plan.md

## V1 Acceptance Scenarios (COMPLETED)
1) **Tiler alignment**  
Given an SVS and `patch_px=256`, when I run the CLI, then tiles are written and `manifest.json` reports `alignment_ok=true` and the lattice params (without ref_mag); the checker prints sample index/center round-trip matches at level-0.

2) **Start level & arrows**  
Given a container, when the slide fully fits at 5×, then the viewer starts at 5×; when it doesn't fit at 5×, then viewer starts at 2.5×. Arrow buttons available at all levels; pressing → moves the viewport by half its width (clamped); grid math remains aligned.

3) **Grid math in viewer**  
Given the manifest, when clicks occur near (0,0) and near edges at different zoom levels, then logged cell indices match the lattice computed for that zoom level; edge cells are not clickable. At 40× with patch_px=256, cells are 256×256; at 20× they are 512×512; at 5× they are 2048×2048; at 2.5× they are 4096×4096 in level-0 coords.

4) **Click→center→step**  
Given 2.5× or 5×, when I click a valid cell, then the view recenters to nearest patch center and steps to next zoom level (2.5→5→10→20→40); at 40× clicking recenters only (no further zoom); Back/Reset work.

5) **Logging & CSV**  
Given a 20s session with clicks and arrow pans, when I export CSV, then rows include `cell_click`, `zoom_step`, `arrow_pan` events, each with correct level‑0 viewport bounds at time of event.

## Unit tests (examples)
- Lattice round‑trip: `indexOf(center(i,j)) == (i,j)` for random i,j in safe range.
- Arrow step math: for a known viewport rect, after → pan, new rect shifts by exactly 0.5× width (clamped).
- Fit checker: given container and slide dims, function returns whether full slide fits at each ladder level.

## V1 Manual Verification Checklist (COMPLETED)
- [x] Tiler runs on 1 SVS → tiles + manifest exist; `alignment_ok=true`. (T-0001 complete)
- [x] App loads slide and displays tissue content (T-0002 complete)
- [x] Free pan/zoom disabled (mouse drag, wheel, click do nothing). (T-0002 complete)
- [x] Fit calculation runs; debug UI shows correct fit status and start level. (T-0002 complete)
- [x] Arrow buttons visible at screen edges. (T-0002 complete)
- [x] Slide starts at exact zoom level (5× when fits at 5×; 2.5× when doesn't fit). (T-0002 complete)
- [x] Arrow buttons functional; pan exactly half screen at all zoom levels. (T-0002 complete)
- [x] Keyboard shortcuts (WASD + arrow keys) work for panning. (T-0002 complete)
- [x] Cell overlay shows (i,j) indices under cursor with [EDGE] label. (T-0002 complete)
- [x] Click ladder behaves (2.5→5→10→20→40); Back/Reset behave; grid cell count changes with zoom. (T-0003 complete)
- [x] Edge cells not clickable; click recenters to nearest patch center. (T-0003 complete)
- [x] Viewport bounds logged with each discrete event. (T-0003 complete)
- [x] CSV exports correctly; each event row has correct level-0 viewport bounds. (T-0003 complete)

---

## V2 Acceptance Scenarios (Multi-User)

6) **Authentication flow**  
Given login page, when I enter valid username/password and submit, then I receive JWT cookie and redirect to viewer; when I enter invalid credentials, then I see error message and remain on login page; when I click logout, then cookie is cleared and I return to login page.

7) **Slide queue with randomization**  
Given 200 slides in database, when two different pathologists log in, then they see different slide orders (deterministic per user_id); when a pathologist completes slide and clicks "Confirm & Next", then next slide in their queue loads automatically; when all slides completed, then "Study Complete" message displays.

8) **Session persistence and event upload**  
Given a pathologist viewing a slide, when they perform 10 interactions, then events are batched and uploaded to backend; when they click "Confirm & Next", then all remaining events upload, session marked complete with label, and database stores all events; when they close browser and reopen, then they resume at next incomplete slide (not mid-slide).

9) **Admin dashboard monitoring**  
Given admin login, when I access `/admin`, then I see table of all pathologists with completion counts (e.g., "User A: 45/200"); when I click "Download CSV", then I receive CSV file with all events from all users/sessions; CSV includes user_id, session_id, and all event columns from spec.

10) **Cloud tile delivery performance**  
Given slides stored in S3 with CloudFront, when pathologist pans/zooms, then tiles load within 500ms (p95); when multiple pathologists access same slide concurrently, then CloudFront cache serves tiles without S3 reads; manifest loading from backend API < 200ms.

## V2 Unit Tests (examples)

- **Auth:** bcrypt.compare() returns true for correct password, false for incorrect; JWT token verification succeeds with valid token, fails with expired/invalid token.
- **Slide randomization:** Given user_id as seed, shuffle function returns consistent order across multiple calls; different user_ids produce different orders.
- **Event batching:** Buffer accumulates events; on 10th event, batch upload triggered; on session complete, all remaining events uploaded.
- **Database queries:** Insert 100 events in single transaction < 100ms; query completion stats for 10 users < 50ms; CSV export of 10k events < 1s.

## V2 Manual Verification Checklist

**T-0004 (Backend) - COMPLETE:**
- [x] Backend TypeScript code compiles successfully
- [x] All API endpoints implemented (auth, slides, sessions, admin)
- [x] JWT authentication middleware working
- [x] Database schema complete with migrations
- [ ] Backend runs locally with PostgreSQL (needs testing)
- [ ] All API endpoints return expected responses (needs testing with curl/Postman)
- [ ] Can create test users and login (needs manual database setup)

> **2025-11-17 verification note:** `npm run build` (frontend) and `npm run build` (backend) both pass locally. API smoke tests remain blocked until the PostgreSQL container is available; rerun curl/Postman checks once the DB is up.

**T-0005 (Frontend Multi-User) - TODO:**
- [ ] Login with valid credentials → redirect to viewer; invalid credentials → error message
- [ ] Slide queue loads first slide automatically after login; progress shows "Slide 1 of N"
- [ ] Events upload every 10 interactions; console shows "[API] Events uploaded"
- [ ] Database `events` rows store both `zoom_level` and `dzi_level` values for uploaded batches
- [ ] "Confirm & Next" uploads events, marks session complete, loads next slide
- [ ] Logout button clears session and returns to login page
- [ ] Two different users see different slide orders (deterministic randomization)
- [ ] Can resume study at next incomplete slide after logout/login
- [ ] Notes captured on Confirm & Next and visible in CSV/downloaded events

> **2025-11-17 verification note:** TypeScript build + lint pass after adding `app_start` logging, notes capture, and buffered-event protections. Full end-to-end login/queue checks are pending a working backend + seeded DB; re-run once services are online.
**T-0006 (Admin Dashboard) - IN TESTING:**
- [x] Admin login redirects to dashboard instead of viewer (code complete)
- [x] Dashboard shows all pathologists with completion counts (code complete)
- [x] Dashboard shows overall study progress stats (code complete)
- [x] Admin CSV export downloads file with all events (code complete)
- [x] CSV filename includes date: `pathology_events_YYYY-MM-DD.csv` (code complete)
- [ ] Manual testing: Admin login shows dashboard (needs verification)
- [ ] Manual testing: Stats cards display correct data (needs verification)
- [ ] Manual testing: User table populates correctly (needs verification)
- [ ] Manual testing: CSV export button works (needs verification)
- [ ] Manual testing: Dashboard logout returns to login (needs verification)

**T-0007 (Cloud Deployment) - TODO:**
- [ ] Tiles uploaded to S3; CloudFront distribution serves tiles correctly
- [ ] Backend deployed to Railway/Render; database migrations run successfully
- [ ] Frontend deployed to Vercel; environment variables configured
- [ ] Production URL loads login page; can complete full pathologist workflow
- [ ] Tiles load from CloudFront within 500ms (performance test)

**T-0009 (Data Verification) - COMPLETE:**
- [x] verify-csv.py validates schema and data integrity
- [x] verify-alignment.py validates coordinate calculations
- [x] verify-sessions.py validates session completeness
- [x] All scripts tested with real CSV data (700 events)
- [x] Scripts produce human-readable reports
- [x] Windows compatibility (ASCII characters)

**T-0010 (Session Replay) - COMPLETE:**
- [x] Admin can select pathologist and slide for replay (code complete)
- [x] Replay shows scanning path with temporal progression (code complete)
- [x] Playback controls work (play, pause, speed, scrubber) (code complete)
- [x] Viewport animates between events (code complete)
- [x] Click markers appear at correct locations (code complete)
- [x] Fixed duplicate sessions in dropdown (bug fix complete)
- [x] Fixed viewer not updating images during replay (bug fix complete)
- [x] Fixed event listener memory leaks (bug fix complete)
- [x] Fixed window resize listener leak (bug fix complete)
- [x] Added error handling for viewport operations (bug fix complete)
- [ ] Manual testing: Replay loads and displays correctly (needs verification)
- [ ] Manual testing: No duplicate sessions in dropdown (needs verification)
- [ ] Manual testing: Images update correctly during replay (needs verification)
- [ ] Manual testing: No memory leaks after multiple replay loads (needs verification)

**T-0011 (Offline Analysis) - TODO:**
- [ ] Jupyter notebook loads and analyzes CSV
- [ ] Summary statistics calculated correctly
- [ ] Heatmap generation script produces valid PNG
- [ ] Scanning path visualization script works
- [ ] Scripts handle multiple sessions

**T-0012 (Patch Extraction) - TODO:**
- [ ] Extract patches from DZI tiles successfully
- [ ] Patches align with clicked cells
- [ ] Visible patch calculator produces valid JSON
- [ ] Both DZI and OpenSlide methods work
- [ ] Batch extraction completes without errors

**T-0008 (Production Readiness) - TODO:**
- [ ] Error handling: network failures show user-friendly messages; retry logic works
- [ ] Database seeded with admin account and test pathologist accounts
- [ ] Loading spinners display during API calls
- [ ] Session resume: refresh page mid-slide returns to same slide
- [ ] Logout confirmation dialog prevents accidental logouts
- [ ] End-to-end test: pathologist completes 5 slides, admin sees progress, CSV exports correctly