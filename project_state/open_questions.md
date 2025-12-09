# Open Questions

## Resolved ✅

| # | Question | Resolution |
|---|----------|------------|
| 1 | Start level policy? | 5× if fits, else 2.5× |
| 2 | Patch size default? | `patch_px=256`, configurable via CLI |
| 3 | Image format? | JPEG Q≈80 |
| 4 | mpp variability? | Record if present, else null with warning |
| 5 | Visual grid overlay? | No overlay; math only (D-0005) |
| 6 | Resume mid-slide? | Restart from beginning (V2) |
| 7 | Event upload frequency? | Every 10 events + on complete + beforeunload |
| 8 | CSV export scope? | All-in-one CSV with all events |
| 9 | Slide queue persistence? | Compute on-the-fly with user_id seed |
| 10 | S3 access control? | Public read (acceptable for anonymized slides) |

---

## Active (T-0007/T-0008)

| # | Question | Notes |
|---|----------|-------|
| 11 | Railway vs Render tier? | Evaluate free vs $5-10/mo during deployment |
| 12 | S3 bucket region? | us-east-1 or closest to users |
| 13 | Rate limiting? | Planned for T-0008; use express-rate-limit |
| 14 | CloudFront cache invalidation? | Manual if needed; use versioned S3 keys |
