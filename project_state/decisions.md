# Architectural Decisions

## V1 Decisions (Local Prototype)

### D-0001: OpenSlide DeepZoom Tiler
Use OpenSlide to generate DZI tiles. Keeps SVS semantics clear; avoids prior libvips issues.

### D-0002: Alignment at Tiling Time
Emit manifest with lattice parameters; run alignment checker as part of tiler. Viewer trusts manifest as source of truth.

### D-0003: Discrete Navigation Only
No free pan; arrow buttons move by 0.5× viewport. Ensures comparable navigation across users.

### D-0004: Zoom-Level-Fixed Lattice
Grid cells = patch_px × patch_px pixels at current zoom. At each zoom: `cell_size_level0 = patch_px * (40/zoom_mag)`. Math in level-0 prevents tile boundary coupling.

### D-0005: No Visual Grid Overlay
Grid math computed internally for tracking. No visual overlay rendered; just mathematical grid for click detection and logging.

### D-0006: 2.5× Base Zoom
Zoom ladder includes 2.5× as lowest. Start at 5× if entire slide fits, else 2.5×.

---

## V2 Decisions (Multi-User Hosted)

### D-0007: TypeScript Full-Stack
TypeScript across frontend (Vite + OpenSeadragon) and backend (Node.js + Express). Reduces context switching.

### D-0008: Split Deployment
Frontend on Vercel (edge CDN); backend on Railway/Render with managed PostgreSQL.

### D-0009: S3 + CloudFront for Tiles
DZI tiles in AWS S3 with CloudFront CDN. Scales to 100-200 slides without backend load.

### D-0010: JWT + bcrypt Auth
Username/password auth with bcrypt hashing, JWT in httpOnly cookies. No email dependency (quick login during breaks).

### D-0011: PostgreSQL 4-Table Schema
Tables: `users`, `slides`, `sessions`, `events`. JSONB for manifest storage.

### D-0012: Deterministic Slide Randomization
Use user_id as PRNG seed for consistent random slide order per pathologist.

### D-0013: Exact Click Coordinates
Click handler centers viewport on **exact click position** while logging exact coordinates for patch extraction. UX uses exact coordinates; data extraction uses logged positions.

### D-0014: Remove Cell Indices
Cell indices (i, j) removed from event logging. Exact click coordinates (`click_x0`, `click_y0`) provide all needed info. Simpler model, easier verification, flexible patch extraction.

### D-0015: Simplified Navigation
Removed keyboard shortcuts (WASD, arrow keys) and mouse wheel zoom. Right-click zooms out keeping center.

### D-0016: Replay Uses Only Logged Data
No calculations in replay - uses exact logged coordinates. If replay doesn't match, indicates logging issue.

### D-0017: Dynamic CORS for Development
Backend accepts multiple localhost ports via origin callback. Production uses single explicit origin.

### D-0018: Proper Event Listener Cleanup
All event listeners and OpenSeadragon viewers must be properly cleaned up. Use flags to prevent duplicate registration; store handler references; destroy viewers before recreation.
