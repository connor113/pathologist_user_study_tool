# Quick Start Deployment Guide

**For:** Developers familiar with cloud deployment  
**Time:** 3-4 hours  
**Prerequisite:** Read [BLOCKERS-AND-DECISIONS.md](BLOCKERS-AND-DECISIONS.md) first

---

## 🎯 The 10-Minute Overview

**Stack:**
- Frontend: Vite → Vercel (static hosting)
- Backend: Express + TypeScript → Railway (Node.js + PostgreSQL)
- Tiles: DZI images → S3 + CloudFront (CDN)

**Flow:**
1. User visits Vercel frontend → Login
2. Frontend calls Railway backend API → JWT auth
3. Backend returns slide manifest + CloudFront URL
4. Frontend (OpenSeadragon) loads tiles from CloudFront
5. User interactions logged → Backend → PostgreSQL

**Deploy order:**
1. AWS (S3 + CloudFront) - tiles first (runs in background)
2. Railway (backend + database) - while tiles upload
3. Vercel (frontend) - after backend is live

---

## ⚡ Ultra-Fast Checklist

### Phase 1: AWS (60 min)

```bash
# 1. Create S3 bucket
# Name: pathology-study-tiles-<your-name>
# Region: us-east-1
# Public read: YES (uncheck block public access)

# 2. Apply bucket policy
# Use: s3-bucket-policy.json (replace bucket name)

# 3. Upload tiles (from uni PC)
aws configure  # Enter IAM credentials
cd /path/to/tiles
aws s3 sync . s3://YOUR-BUCKET/slides/ --exclude "*.dzi"

# 4. Create CloudFront distribution
# Origin: Your S3 bucket
# OAC: Create new, sign requests
# Cache: CachingOptimized
# Wait 10-15 min for deployment

# 5. Update S3 policy with CloudFront ARN
# Copy policy from CloudFront → Origins → Edit → Copy policy
# Paste into S3 → Permissions → Bucket Policy

# ✅ Save: CLOUDFRONT_URL (e.g., https://d123abc.cloudfront.net)
```

### Phase 2: Railway (45 min)

```bash
# 1. Create Railway project from GitHub
# railway.app → New Project → Deploy from repo

# 2. Add PostgreSQL
# + New → Database → PostgreSQL
# Note: DATABASE_URL auto-provided

# 3. Set environment variables
# Copy from: env.production.backend
# Generate JWT_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Set: JWT_SECRET, AWS keys, S3_BUCKET_NAME, CLOUDFRONT_URL, FRONTEND_URL (placeholder)

# 4. Copy Procfile to repo root (if not present)
cp deployment-prep/Procfile .
git add Procfile
git commit -m "Add Procfile"
git push

# 5. Railway auto-deploys (wait 3-5 min)

# 6. Run migrations
railway link  # Select your project
railway run psql $DATABASE_URL -f backend/src/db/migrations/001_initial.sql
railway run psql $DATABASE_URL -f backend/src/db/migrations/002_add_dzi_level_to_events.sql
railway run psql $DATABASE_URL -f backend/src/db/migrations/003_add_notes_column.sql

# 7. Seed users
cd backend
railway run npx ts-node scripts/create-test-users.ts

# 8. Seed slides
# Either: railway run npx ts-node scripts/seed-slides.ts
# Or: Use seed-slides-manual.sql in Railway query editor

# ✅ Save: BACKEND_URL (e.g., https://your-app.up.railway.app)
# ✅ Test: curl https://your-app.up.railway.app/health
```

### Phase 3: Vercel (30 min)

```bash
# 1. Import GitHub repo
# vercel.com → New Project → Import your-repo

# 2. Framework: Vite (auto-detected)
# Root: ./ (default)
# Build: npm run build (auto-detected)
# Output: dist (auto-detected)

# 3. Deploy (wait 2 min)

# 4. Add environment variable
# Settings → Environment Variables
# Name: VITE_API_URL
# Value: https://your-app.up.railway.app (from Phase 2)
# Environments: Production, Preview, Development (all)

# 5. Redeploy
# Deployments → Latest → ⋯ → Redeploy

# ✅ Save: FRONTEND_URL (e.g., https://your-app.vercel.app)
```

### Phase 4: Update CORS (5 min)

```bash
# Update Railway backend with Vercel URL
railway variables set FRONTEND_URL=https://your-app.vercel.app

# Railway auto-redeploys (wait 2 min)
```

### Phase 5: Test (15 min)

```bash
# 1. Health check
curl https://your-app.up.railway.app/health
# Expected: {"status":"ok","timestamp":"...","database":"connected"}

# 2. Login test
# Visit: https://your-app.vercel.app
# Login: admin / admin123
# Expected: No CORS errors, viewer loads

# 3. Tile test
# Open DevTools → Network → Filter: Images
# Pan/zoom in viewer
# Expected: Tiles load from *.cloudfront.net

# 4. Event test
# Click on slide, pan around
# Railway logs should show: "[API] Events uploaded"
# Database: railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM events;"
```

---

## 🔑 Critical Values to Track

```bash
# AWS
S3_BUCKET_NAME=pathology-study-tiles-<your-name>
CLOUDFRONT_URL=https://d123abc.cloudfront.net
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Railway
BACKEND_URL=https://your-app.up.railway.app
DATABASE_URL=postgresql://... (auto-provided, don't copy)
JWT_SECRET=<generated hex string>

# Vercel
FRONTEND_URL=https://your-app.vercel.app
```

**Save these in password manager!**

---

## 🚨 Common Gotchas

### 1. CORS Errors
**Symptom:** Browser console: "blocked by CORS policy"  
**Fix:** Update Railway `FRONTEND_URL` to match Vercel URL exactly, redeploy

### 2. Tiles Not Loading (403)
**Symptom:** Broken images in viewer  
**Fix:** Update S3 bucket policy with CloudFront ARN (Step 5 of AWS phase)

### 3. Database Connection Fails
**Symptom:** Backend crashes, logs show "connection refused"  
**Fix:** `DATABASE_URL` is auto-provided by Railway, don't manually set it

### 4. Build Fails (Railway)
**Symptom:** Deployment fails, build logs show errors  
**Fix:** Check `Procfile` path is correct: `web: cd backend && npm start`

### 5. Build Fails (Vercel)
**Symptom:** Deployment fails, "VITE_API_URL is not defined"  
**Fix:** Add `VITE_API_URL` env var in Vercel, redeploy

---

## 📁 Files to Copy to Repo (Optional)

**Recommended:**
```bash
cp deployment-prep/Procfile .
cp deployment-prep/vercel.json .
git add Procfile vercel.json
git commit -m "Add deployment configs"
git push
```

**Not needed** (Railway/Vercel auto-detect):
- `railway.json` (only if Procfile doesn't work)
- `.env.production` (use dashboard env vars instead)

---

## 🔄 Deployment Flow Diagram

```
┌─────────────┐
│   AWS S3    │ ← Upload tiles (uni PC)
│  (Storage)  │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ CloudFront  │ ← Serve tiles (CDN)
│   (CDN)     │
└─────────────┘
       ↑
       │ Fetch tiles
       │
┌──────┴──────┐        ┌─────────────┐
│   Vercel    │ ←─────→│  Railway    │
│ (Frontend)  │  API   │  (Backend)  │
└─────────────┘        └──────┬──────┘
       ↑                      │
       │                      ↓
       │               ┌─────────────┐
       │               │ PostgreSQL  │
       │               │ (Database)  │
       │               └─────────────┘
       │
   User Browser
```

---

## 🎯 Success Criteria

Deployment is complete when:
- [x] `curl BACKEND_URL/health` returns 200 OK
- [x] Frontend loads without errors
- [x] Login works (admin / admin123)
- [x] Slide viewer loads and displays tiles
- [x] Tiles load from CloudFront (check Network tab)
- [x] Pan/zoom works smoothly
- [x] No CORS errors in browser console
- [x] Events save to database

---

## 🚀 Pro Tips

1. **Run tile upload first** - It takes longest, let it run in background
2. **Use Railway CLI** - Much faster than web UI for migrations/seeding
3. **Test each phase** - Don't move on until previous phase works
4. **Save URLs immediately** - Copy/paste to notes before moving on
5. **Check logs constantly** - Railway and Vercel both have real-time logs

---

## 📞 Need Full Guide?

See [00-DEPLOYMENT-CHECKLIST.md](00-DEPLOYMENT-CHECKLIST.md) for:
- Detailed step-by-step instructions
- Troubleshooting for every step
- Cost estimates
- Security considerations
- Post-deployment maintenance

---

## ⏱️ Time Breakdown

| Phase | Optimistic | Realistic | Pessimistic |
|-------|-----------|-----------|-------------|
| AWS Setup | 45 min | 60 min | 90 min |
| Railway | 30 min | 45 min | 60 min |
| Vercel | 20 min | 30 min | 45 min |
| Testing | 10 min | 15 min | 30 min |
| **Total** | **1.75 hr** | **2.5 hr** | **3.5 hr** |

**Plus:** Tile upload time (30 min - 2 hr) runs in parallel

**Realistic total:** 3-4 hours if no major issues

---

**Good luck! 🚀**
