# open_questions.md

## V1 Questions (RESOLVED)
1) ~~**Start level policy:** Prefer *always 5×* (with arrows) vs *lowest that fits*?~~ **RESOLVED:** Include 2.5× in zoom ladder; start at 5× if entire slide fits at 5×, else start at 2.5×. Arrow panning available at all levels.
2) ~~**Patch size default:** Global default `patch_px=256` or per‑slide override?~~ **RESOLVED:** Default `patch_px=256`, configurable via CLI `--patch-px` flag. No ref_mag needed; grid is zoom-level-fixed.
3) **Image format:** JPEG vs WebP; Q factor; storage/CPU trade‑off on your machine.  
4) **mpp variability:** Record `mpp0` if present (else `null` with warning) for documentation; ensure alignment math works for slides whose reported mag≠40×.
5) ~~**Visual grid overlay:** Initially spec'd as required~~ **RESOLVED (D-0005):** V1 uses invisible grid with click highlighting only. May add optional toggle in V2 if user testing shows confusion about patch boundaries.

## V2 Questions (Multi-User Hosted)
6) **Backend hosting choice:** Railway vs Render for backend + PostgreSQL? Both offer one-click PostgreSQL; Railway has better free tier, Render has simpler pricing. **Decision deferred to T-0007 (Cloud Deployment)** - will evaluate both platforms side-by-side during deployment task.

7) **S3 access control:** Public read access (simpler) vs signed URLs (more secure)? Public read acceptable for anonymized study slides; signed URLs add complexity but prevent unauthorized access. **Decision: Public read** for V2 (simpler, acceptable for anonymized study). Can add signed URLs in V3 if IRB requires.

8) **Session resume strategy:** If pathologist refreshes page mid-slide, resume from current zoom/position (stored in database) or restart slide from beginning? Resume requires storing viewport state; restart is simpler but may frustrate users. **Decision: Restart slide from beginning** (V2). Backend already supports session resume (returns existing incomplete session), but no viewport state storage. V3 can add viewport resume if user testing shows frustration.

9) **Event upload frequency:** Batch upload every N events (e.g., 10) vs time-based (e.g., every 30s) vs only on slide complete? Frequent uploads = better crash recovery; slide-complete-only = simpler but risks data loss on browser crash. **Decision: Every 10 events** + on slide complete. Backend already supports batch event upload endpoint.

10) **Admin CSV export scope:** Download all events for all users (single massive CSV) vs per-user CSV vs per-slide CSV? All-in-one simplest for analysis; separate files easier to manage. May need both options. **Decision: All-in-one CSV** (V2). Backend implements `GET /api/admin/export/csv` returning all events. Can add filtered exports in V3 if needed.

11) **Slide queue persistence:** Store slide order in database (precomputed) vs compute deterministically on each page load? Database storage = faster; on-the-fly computation = less storage, always consistent with seed. **Decision: Compute on-the-fly** using deterministic shuffle with user_id as seed (per D-0012). Backend returns slides in upload order; frontend will implement shuffle in T-0005.

12) **CloudFront cache invalidation:** If slide tiles are updated, how to invalidate CDN cache? Rare for study (tiles precomputed once), but may need process for corrections. Consider versioned S3 keys or manual CloudFront invalidation. **Decision: Manual invalidation** if needed (rare). CloudFront invalidation API available for corrections. For frequent updates, can use versioned S3 keys (e.g., `slides/v2/slide_id/...`). Defer until T-0007.