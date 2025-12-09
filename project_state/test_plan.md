# Test Plan

## V1 Scenarios ✅ COMPLETE

1. **Tiler:** SVS → DZI tiles + `manifest.json` with `alignment_ok=true`
2. **Start Level:** 5× if fits, else 2.5×. Arrows available at all levels.
3. **Click→Zoom:** Click recenters on exact position, steps zoom ladder. At 40× clicking does nothing.
4. **Logging:** CSV includes all events with level-0 viewport bounds.

---

## V2 Scenarios

### Authentication ✅
- [x] Valid credentials → JWT cookie + redirect
- [x] Invalid credentials → error message
- [x] Logout → cookie cleared, return to login

### Slide Queue ✅
- [x] Different users see different slide orders
- [x] Deterministic shuffle using user_id seed
- [x] "Confirm & Next" loads next slide

### Session Persistence ✅
- [x] Events batched every 10 interactions
- [x] Events uploaded on slide completion
- [x] Events flushed on beforeunload
- [x] Resume at next incomplete slide after login

### Admin Dashboard ✅
- [x] Admin login → dashboard (not viewer)
- [x] Shows pathologists with completion counts
- [x] CSV export downloads with date-stamped filename

### Session Replay ✅
- [x] Select pathologist and session for replay
- [x] Scanning path visualization with gradient
- [x] Playback controls (play, pause, speed, scrubber)
- [x] Smooth viewport animations
- [x] Proper cleanup (no memory leaks)

### Data Verification ✅
- [x] verify-csv.py validates schema and data
- [x] verify-alignment.py validates coordinates
- [x] verify-sessions.py validates completeness

---

## Pending Scenarios

### T-0011: Offline Analysis ⬜
- [ ] Jupyter notebook loads and analyzes CSV
- [ ] Heatmap generation produces valid PNG
- [ ] Scanning path visualization works

### T-0012: Patch Extraction ⬜
- [ ] Extract patches from DZI tiles
- [ ] Patches align with click coordinates
- [ ] Visible patch calculator produces valid JSON

### T-0007: Cloud Deployment ⬜
- [ ] Tiles served from CloudFront
- [ ] Backend on Railway/Render
- [ ] Frontend on Vercel
- [ ] End-to-end workflow works in production

### T-0008: Production Readiness ⬜
- [ ] Loading spinners during API calls
- [ ] Error handling with user-friendly messages
- [ ] Database seeding script works
- [ ] End-to-end: complete 5 slides, export CSV
