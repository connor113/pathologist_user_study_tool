# instructions.md

## V1 (Local Prototype) - COMPLETED

- **Stack:** Vite, **TypeScript**, **OpenSeadragon**; no backend. 
- **Tiles:** Use **OpenSlide** Python CLI to precompute DeepZoom tiles with `tile_size=512`, `overlap=0`. Emit `manifest.json` alongside tiles with lattice params and `alignment_ok`.
- **Geometry:** Implement `GridLattice` (pure TS module): given `{patch_px, current_zoom_mag, level0_w,h}` compute `cell_size_level0 = patch_px * (40 / current_zoom_mag)`, `indexOf(x0,y0)`, `center(i,j)`, `isEdgeCell(i,j)`. Grid recomputes when zoom changes; cells are fixed in pixel space at each zoom level.
- **Viewer config:** OSD created with pan/zoom controls disabled except custom arrow buttons; wheel zoom off.
- **Navigation controls:** Buttons ↑,↓,←,→ (no keyboard shortcuts); step = 0.5× viewport in world coordinates; clamp to slide bounds. No panning when entire slide visible. Right-click zooms out one level while keeping current center (no recenter). Default right-click menu is blocked.
- **Zoom ladder:** 2.5×, 5×, 10×, 20×, 40×. Start at 5× if entire slide fits at 5×, else start at 2.5×. Arrow panning available at all levels. Click centers on exact click position (not cell center).
- **Logging:** Events uploaded to backend in batches; each discrete event includes viewport bounds and exact click coordinates (`click_x0`, `click_y0` for `cell_click` events). Cell indices (i, j) have been removed from event logging.
- **Magnification display:** Shows "Fit to screen" when zoomed out, or "X×" (e.g., "2.5×", "5×") when at specific magnification level. Displayed in sidebar.

Conventions: minimal deps; no secrets; math in level‑0; grid is zoom-level-fixed (patch_px pixels at current zoom); `FREE_PAN=false`.

---

## V2 (Multi-User Hosted) - IN PROGRESS

### Backend Conventions (Node.js + Express + TypeScript)

- **Project structure:** `backend/src/` with subdirs: `routes/`, `middleware/`, `db/`, `utils/`.
- **Database:** PostgreSQL via `pg` library; use parameterized queries (`$1, $2`) to prevent SQL injection.
- **Migrations:** SQL files in `backend/src/db/migrations/`; name format `NNN_description.sql`; run manually or via migrate script.
- **Error handling:** Use try/catch in async route handlers; return `{error: string}` JSON with appropriate HTTP status codes (400 client error, 500 server error).
- **Auth middleware:** JWT verification in `middleware/auth.ts`; attach `req.user` for downstream handlers; protect routes with `authenticate` middleware.
- **Password security:** Use `bcrypt.hash()` with salt rounds=10 for registration; `bcrypt.compare()` for login.
- **Environment variables:** Never commit secrets; use `.env` file locally (gitignored); access via `process.env.VAR_NAME`.
- **Logging:** Use `console.log` for development; prefix with `[AUTH]`, `[DB]`, `[API]` for clarity.

### API Design Patterns

- **RESTful endpoints:** `GET /api/resource`, `POST /api/resource`, `GET /api/resource/:id`, etc.
- **Response format:** Always JSON; success = `{data: {...}}`, error = `{error: "message"}`.
- **Authentication:** JWT in httpOnly cookie (`Set-Cookie` header from server); frontend sends cookie automatically.
- **CORS:** Enable CORS middleware with credentials; whitelist frontend origin (Vercel URL in production).
- **Rate limiting:** Consider adding in production (e.g., express-rate-limit) to prevent abuse.
- **Validation:** Validate request bodies; reject invalid data early with 400 status.

### Frontend Conventions (V2 additions)

- **API calls:** Use `fetch()` with `credentials: 'include'` to send cookies; wrap in try/catch for network errors.
- **State management:** Simple in-memory state for current user, slide queue, session; no Redux/Zustand needed for V2.
- **Environment variables:** Use `import.meta.env.VITE_API_URL` for backend base URL; set in `.env.local` (gitignored) and Vercel dashboard.
- **Loading states:** Show spinner/message during API calls; disable buttons during submission.
- **Error handling:** Display user-friendly error messages; log details to console for debugging.
- **Session management:** Store minimal state in memory; rely on backend session/events for persistence; clear state on logout.
- **Notes logging:** Persist sidebar notes by attaching them to the `slide_next` event (`notes` column) when Confirm & Next is pressed; clear the textarea for each new slide.
- **Event buffering:** Buffer uploads in batches of 10 but also auto-flush every 5s and on `beforeunload` / `visibilitychange` via `navigator.sendBeacon` to minimize data loss.
- **Navigation:** Keyboard shortcuts (WASD, arrow keys) and mouse wheel zoom are disabled. Right-click zooms out while keeping current center. Click centers on exact click position (not cell center).
- **Window management:** Prompt user to maximize window on login (auto-dismisses after 8 seconds). Viewer correctly resizes on window maximize, refitting image if in "fit" mode.

### Deployment Conventions

- **Git workflow:** Push to GitHub main branch triggers auto-deploy on Vercel (frontend) and Railway/Render (backend).
- **Environment parity:** Use same `.env` structure locally and in production; document all required vars in `backend/.env.example`.
- **Database migrations:** Run migrations manually on production database after deployment (via Railway/Render dashboard or CLI).
- **Secrets management:** Store secrets (JWT_SECRET, AWS keys) only in hosting platform env vars; never in code or git.
- **Monitoring:** Check Railway/Render logs for backend errors; Vercel logs for frontend build issues.

**Detailed Deployment Guide:** See `DEPLOYMENT.md` for complete step-by-step instructions, cost breakdown, and troubleshooting.

### S3 + CloudFront Conventions

- **Bucket structure:** `slides/{slide_id}/manifest.json`, `slides/{slide_id}/files/{level}/{x}_{y}.jpeg`.
- **Access control:** Public read on bucket (or signed URLs if security needed); CloudFront caching with 24hr TTL.
- **Upload script:** Node.js script in `scripts/upload-tiles-to-s3.js`; batch uploads with progress logging; inserts slide metadata to database after upload.
- **Tile URLs:** Frontend constructs URLs as `${CLOUDFRONT_URL}/slides/${slideId}/files/${level}/${x}_${y}.jpeg`.
- **Manifest serving:** Backend serves manifests from database (JSONB column), not from S3, to avoid extra S3 reads.

### Database Schema Conventions

- **Primary keys:** Use UUIDs (`gen_random_uuid()` in PostgreSQL) for all tables; avoids enumeration attacks.
- **Timestamps:** Use `TIMESTAMPTZ` (timezone-aware); set `DEFAULT CURRENT_TIMESTAMP` for created_at; update completed_at on session finish.
- **Foreign keys:** Always add `ON DELETE CASCADE` or `ON DELETE SET NULL` to prevent orphaned records.
- **Indexes:** Add indexes on frequently queried columns (user_id, slide_id, session_id).
- **JSONB:** Use for manifest storage; allows querying nested fields without schema changes; index with GIN if needed for performance.

Conventions: TypeScript everywhere; RESTful APIs; httpOnly cookies for auth; parameterized queries; minimal frontend state; S3 for tiles; PostgreSQL for metadata/logs.