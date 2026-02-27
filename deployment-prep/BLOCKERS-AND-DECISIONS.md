# Deployment Blockers & Decision Points

**Prepared:** 2026-02-16  
**Project:** Pathologist User Study Web App

---

## 🚧 Critical Blockers (Must Resolve Before Deployment)

### 1. **AWS Account Creation** ⏱️ 5-10 min
**Status:** Not started  
**Blocker:** Need AWS account to create S3 bucket and CloudFront

**Actions:**
- [ ] Sign up at aws.amazon.com
- [ ] Provide credit card (for billing)
- [ ] Verify email and phone
- [ ] Set up billing alerts ($20-30/month threshold)

**Decision:** None - must do this

---

### 2. **Railway Account Creation** ⏱️ 5 min
**Status:** Not started  
**Blocker:** Need Railway account for backend + PostgreSQL

**Actions:**
- [ ] Sign up at railway.app
- [ ] Link GitHub account
- [ ] Verify email

**Alternative:** Use Render (render.com) instead - similar pricing/features

**Decision:** Railway vs Render?
- **Recommendation:** Railway (better PostgreSQL integration, easier setup)

---

### 3. **Vercel Account Creation** ⏱️ 5 min
**Status:** Not started  
**Blocker:** Need Vercel account for frontend deployment

**Actions:**
- [ ] Sign up at vercel.com
- [ ] Link GitHub account
- [ ] Verify email

**Decision:** None - Vercel is ideal for Vite frontend

---

### 4. **Tile Files Location & Access** ⏱️ Variable
**Status:** Tiles are on uni PC at unknown exact path  
**Blocker:** Need access to tiles to upload to S3

**Known Info:**
- Tiles on uni PC: `100.116.210.90` (user: `2005348`)
- 20 slides already tiled
- Access via RustDesk + Tailscale
- SSH server installed but key auth not working

**Actions:**
- [ ] Locate exact path of tiles on uni PC (likely `D:\Data\pathology_tiles\` or similar)
- [ ] Verify 20 slides are actually tiled and ready
- [ ] Count total size (estimate: ~100GB for 20 slides)
- [ ] Check if manifest.json files exist for each slide

**Decision:** Upload method?
- **Option A:** AWS CLI from uni PC (recommended - faster, resumable)
  - Requires installing AWS CLI on uni PC
  - Requires configuring AWS credentials
  - Can run in background, takes 30min-2hr depending on bandwidth
- **Option B:** Download to VPS, then upload (slower)
  - Requires SSH file transfer working
  - Double transfer time (uni→VPS→S3)
  - Not recommended unless AWS CLI fails

**Recommendation:** Option A (AWS CLI from uni PC)

---

### 5. **Slide Manifest Files** ⏱️ 15-30 min
**Status:** Unknown if manifest.json files exist  
**Blocker:** Need manifest JSON for each slide to seed database

**Expected location:** `D:\Data\pathology_tiles\slide_001_files\manifest.json`

**If manifests don't exist:**
- Need to regenerate from tiling script
- Or manually construct from slide metadata
- See `seed-slides-manual.sql` template

**Actions:**
- [ ] Verify manifest.json exists for each slide
- [ ] Copy manifest contents for database seeding
- [ ] Validate JSON format

**Decision:** If manifests missing, how to recreate?
- **Option A:** Re-run tiling script with `--manifest-only` flag (if supported)
- **Option B:** Use OpenSlide to get slide dimensions and generate manifest
- **Option C:** Manual construction (tedious for 20 slides)

**Recommendation:** Check if manifests exist first, then decide

---

## ⚠️ Important Decisions (Affect Cost/Performance)

### 6. **AWS Region Selection** ⏱️ 1 min
**Impact:** Network latency, data transfer costs

**Options:**
- `us-east-1` (N. Virginia) - Default, cheapest, most features
- `us-west-2` (Oregon) - West coast, slightly more expensive
- `eu-west-1` (Ireland) - Europe, higher cost for US users

**Question:** Where are the pathologists located?
- **If US-based:** `us-east-1` (recommended)
- **If UK/EU-based:** `eu-west-1`
- **If global:** `us-east-1` with CloudFront (CDN handles global delivery)

**Recommendation:** `us-east-1` unless all users in specific region

---

### 7. **CloudFront Price Class** ⏱️ 1 min
**Impact:** ~$10-20/month cost difference

**Options:**
- **All edge locations:** Best performance, highest cost (~$40/month for 100GB transfer)
- **North America + Europe:** Good performance for US/EU, medium cost (~$30/month)
- **North America only:** Lowest cost (~$20/month), US/Canada only

**Question:** Where are users located?
- **Recommendation:** Start with "All edge locations" for best performance
- Can downgrade later if costs are too high and users are region-specific

---

### 8. **Railway vs Render** ⏱️ Decision only
**Impact:** Monthly cost, ease of use

**Railway:**
- ✅ Starter: $5/month (500 hours compute)
- ✅ PostgreSQL included
- ✅ Easier setup
- ✅ Better GitHub integration
- ❌ Less mature than Render

**Render:**
- ✅ Starter: $7/month
- ✅ PostgreSQL: $7/month (separate)
- ✅ More mature platform
- ✅ Better documentation
- ❌ Total: $14/month (more expensive)

**Recommendation:** Railway ($5/month total, easier setup)

---

### 9. **Number of Test Pathologist Accounts** ⏱️ 5 min
**Impact:** Initial testing phase

**Default:** 2 test accounts (`pathologist1`, `pathologist2`)

**Question:** How many accounts needed?
- Pilot study: 2-3 accounts
- Full study: Create real accounts with actual usernames

**Actions:**
- [ ] Decide test account count
- [ ] Decide real account naming scheme (email-based? initials? IDs?)

**Recommendation:** Start with 2 test accounts, create real accounts after pilot

---

### 10. **Slide Upload Order/Priority** ⏱️ Planning
**Impact:** Which slides available first

**Question:** Upload all 20 slides at once or in batches?
- **Option A:** Upload all at once (30min-2hr depending on size)
- **Option B:** Upload 2-3 test slides first, validate, then upload rest

**Recommendation:** Option B
1. Upload 2 test slides first (~5-10 min)
2. Complete full deployment pipeline
3. Test end-to-end with test slides
4. Upload remaining 18 slides once validated

**Benefits:**
- Faster initial deployment
- Catch issues early
- Can test with real data sooner

---

## 📊 Infrastructure Decisions (Can Decide Later)

### 11. **Custom Domain** ⏱️ Optional, 30 min
**Impact:** Branding, professionalism

**Default URLs:**
- Frontend: `pathology-study.vercel.app`
- Backend: `pathology-study.up.railway.app`

**Custom domain:**
- Frontend: `study.youruniversity.edu`
- Backend: `api.study.youruniversity.edu`

**Actions if yes:**
- [ ] Purchase domain (or use university subdomain)
- [ ] Configure DNS in Vercel/Railway
- [ ] SSL certificates (automatic with Vercel/Railway)

**Recommendation:** Use default URLs for now, add custom domain later if needed

---

### 12. **Monitoring & Alerting** ⏱️ Optional, 15 min
**Impact:** Proactive issue detection

**Options:**
- AWS CloudWatch (costs extra, ~$5-10/month)
- Railway/Vercel built-in monitoring (free)
- External: Sentry, LogRocket, etc. (overkill for this study)

**Recommendation:** 
- Start with built-in Railway/Vercel monitoring
- Set up AWS billing alerts (free, important)
- Add advanced monitoring only if issues arise

---

### 13. **Database Backups** ⏱️ 15 min setup
**Impact:** Data loss prevention

**Options:**
- Manual backups via Railway CLI (free, requires discipline)
- Railway automated backups (paid tier, ~$10/month extra)
- Scheduled cron job (free, requires setup)

**Recommendation:**
- Start with weekly manual backups:
  ```bash
  railway run pg_dump $DATABASE_URL > backup-YYYYMMDD.sql
  ```
- Automate after study is stable

---

## 🎯 Post-Deployment Decisions

### 14. **Real User Account Creation** ⏱️ 5 min per user
**After pilot study successful**

**Question:** Naming convention?
- Email-based: `user@example.com`
- Initials: `jdoe`, `asmith`
- ID numbers: `path001`, `path002`
- Mixed: `jdoe-001`

**Recommendation:** Discuss with study coordinator

---

### 15. **Slide Anonymization Verification** ⏱️ 30 min
**Before production launch**

**Actions:**
- [ ] Verify all slide IDs are anonymized
- [ ] Check no patient info in manifest JSON
- [ ] Confirm IRB approval for slide data

**Blocker:** Cannot go live without this

---

### 16. **Study User Guide** ⏱️ 1-2 hours
**Before inviting real pathologists**

**Content:**
- Login instructions
- How to navigate viewer
- Keyboard shortcuts
- Diagnosis selection
- Contact info for support

**Recommendation:** Create after pilot test feedback

---

## 📝 Summary of Immediate Actions

**Before starting deployment:**

1. ✅ Create AWS account (5 min)
2. ✅ Create Railway account (5 min)
3. ✅ Create Vercel account (5 min)
4. ✅ Locate tiles on uni PC + verify manifests exist (15 min)
5. ❓ Decide AWS region (1 min decision)
6. ❓ Decide CloudFront price class (1 min decision)
7. ❓ Decide upload strategy (all at once vs batched)

**Total prep time:** ~30 minutes + account creation

**Can proceed once:** Accounts created + tiles located

---

## ⏰ Estimated Time to Production

**Pessimistic (first time, issues):** 6-8 hours  
**Optimistic (smooth run):** 3-4 hours  
**Realistic:** 4-5 hours

**Breakdown:**
- AWS setup: 60-90 min
- Railway setup: 45-60 min
- Vercel setup: 30-40 min
- Database seeding: 30-40 min
- Testing: 30 min
- Tile upload: 30min-2hr (parallel, run in background)

**Recommendation:** 
- Start tile upload FIRST (runs in background)
- Continue with other phases while tiles upload
- Total wall time: ~3-4 hours if well-organized

---

## 🚀 Ready to Deploy?

**Checklist:**
- [ ] All accounts created
- [ ] Tiles located and accessible
- [ ] Manifests verified
- [ ] AWS region decided
- [ ] CloudFront price class decided
- [ ] 4-6 hours available for deployment
- [ ] Read through deployment checklist
- [ ] Backup plan if something breaks

**Status:** ⏸️ Waiting on account creation and tile verification

---

**Questions for Connor:**

1. Where exactly are the tiles stored on uni PC? (path?)
2. Do manifest.json files exist for each slide?
3. What AWS region do you prefer? (us-east-1 recommended)
4. Are all pathologists US-based? (affects CloudFront price class)
5. Do you want to upload all 20 slides at once or test with 2-3 first?
6. When do you want to do the deployment? (need 4-5 hour block)
