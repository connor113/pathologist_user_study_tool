**D-0001: Precompute with OpenSlide**  
Start with **OpenSlide DeepZoom** tiler to avoid prior libvips issues and to keep SVS semantics clear. Keep libvips (`dzsave`) as optional future optimization once V1 is stable.

**D-0002: Alignment at tiling time**  
Emit a manifest with lattice parameters and run an alignment checker as part of the tiler. Viewer trusts manifest as the source of truth.

**D-0003: No free pan; discrete arrows only**  
Ensures comparable navigation across users while still enabling coverage when slides can’t fully fit.

**D-0004: Zoom‑level‑fixed lattice independent of tiles**  
Grid cells represent patch_px × patch_px pixels at the current zoom level. At each zoom, cell_size_level0 = patch_px * (40/zoom_mag). This ensures grid alignment with patches that would be extracted at each specific magnification level. Grid math in level‑0 prevents any coupling to tile boundaries.

**D-0005: No visual grid overlay (V1)**  
Grid lattice math is computed internally to track patch alignment, but no visual overlay is rendered. Rationale: (1) Visual grid may distract from tissue examination, (2) Click detection and logging only require mathematical grid, not visual representation, (3) Transparency can be achieved through documentation/training rather than UI clutter. If user feedback indicates confusion about patch boundaries, can revisit as optional overlay in V2. Viewport bounds and clicked patch indices are still logged with all events.

**D-0006: Simple fit logic with 2.5× base level**  
Zoom ladder includes 2.5× as lowest magnification. Start level logic is simple: check if entire slide fits at 5×. If yes, start at 5×; if no, start at 2.5×. No need to check other zoom levels. Rationale: Simplicity; 2.5× should fit almost any slide; arrow panning available at all levels regardless of fit.

**D-0007: TypeScript full-stack architecture (V2)**  
Use TypeScript across frontend and backend for consistency and easier learning curve. Backend: Node.js + Express + TypeScript. Frontend: existing Vite + TypeScript + OpenSeadragon. Rationale: Unified language reduces context switching; TypeScript provides type safety across API boundaries; Express is lightweight and well-documented for beginners.

**D-0008: Split deployment architecture (V2)**  
Frontend deployed to Vercel (free tier, zero-config); backend deployed to Railway or Render ($5-20/mo with managed PostgreSQL). Rationale: Separation of concerns; frontend CDN benefits from Vercel's edge network; backend needs persistent database connection; Railway/Render provide one-click PostgreSQL with automatic migrations.

**D-0009: S3 + CloudFront for tile storage (V2)**  
Store all DZI tiles in AWS S3 with CloudFront CDN for instant global delivery. Rationale: (1) Ensures instant tile loading regardless of pathologist location, (2) Scales to 100-200 slides without backend load, (3) CloudFront caching prevents repeated S3 reads, (4) Pay-as-you-go pricing (~$20-50/mo). Alternative considered: serving tiles directly from backend rejected due to bandwidth/latency constraints.

**D-0010: JWT + bcrypt authentication (V2)**  
Simple username/password auth with bcrypt password hashing and JWT tokens stored in httpOnly cookies. Rationale: (1) No email dependency (pathologists requested quick login during breaks), (2) httpOnly cookies prevent XSS attacks, (3) JWT enables stateless auth across API requests, (4) bcrypt industry-standard for password security. Rejected: magic links (too slow), OAuth (unnecessary complexity for closed study).

**D-0011: PostgreSQL with 4-table schema (V2)**  
Database schema: `users` (pathologists + admins), `slides` (metadata + S3 paths), `sessions` (user-slide pairs with labels), `events` (interaction logs linked to sessions). Rationale: (1) Normalized design enables efficient queries for admin dashboard, (2) Separating sessions from events allows batch event uploads, (3) JSONB for manifest storage avoids schema migrations per slide type, (4) PostgreSQL widely supported by hosting platforms.

**D-0012: Deterministic slide randomization per user (V2)**  
Use user_id as PRNG seed to generate consistent random slide order per pathologist. Rationale: (1) All pathologists see all slides but in different sequences (reduces ordering bias), (2) Deterministic shuffle allows page refreshes without losing progress, (3) Computed on-the-fly (no database storage needed), (4) Seed-based approach ensures reproducibility for analysis.

**D-0013: Dual-purpose click centering (V1)**  
Click handler centers viewport on **exact click position** for smooth UX while logging **grid cell indices** `(i, j)` for patch extraction. Rationale: (1) Exact centering ensures artifacts user clicks on stay centered through zoom steps (matches mouse wheel behavior), (2) Cell indices still logged for precise patch alignment in training data, (3) Viewport bounds capture all visible patches for context analysis, (4) Separation of concerns: UX uses exact coordinates, data extraction uses grid cells. This dual approach provides both natural navigation for pathologists and aligned patches for model training.

**D-0014: Dynamic CORS for multiple development ports (V2)**  
Backend CORS configured to accept requests from multiple localhost ports (5173, 5174) using origin callback function. Rationale: (1) Vite dev server auto-increments port when 5173 is occupied, (2) Prevents login failures when multiple dev servers accidentally run, (3) Development-only issue (production uses single frontend URL), (4) Callback-based CORS allows flexible origin checking without breaking credentials. Production deployments should use single explicit origin from environment variable.

**D-0015: Proper Event Listener and Resource Cleanup (V2)**  
All event listeners and resources must be properly cleaned up to prevent memory leaks and duplicate handlers. Rationale: (1) Event listeners added without cleanup cause memory leaks and duplicate event firing, (2) OpenSeadragon viewers must be destroyed before creating new ones to prevent conflicts, (3) Window event listeners persist across component lifecycle if not removed, (4) Storing handler references enables proper cleanup. Implementation: Use flags to prevent duplicate listener registration, store all handler references for cleanup, destroy viewers before recreation, remove all listeners in cleanup functions (e.g., `hideReplayPage()`).