# Deployment Checklist

**Project:** Pathologist User Study Web App  
**Stack:** Vercel (frontend) + Railway (backend/PostgreSQL) + AWS S3+CloudFront (tiles)  
**Preparation Date:** 2026-02-16

---

## Prerequisites ✅

Before starting, ensure you have:

- [ ] GitHub account with code pushed
- [ ] AWS account (free tier available)
- [ ] Railway account (or Render alternative)
- [ ] Vercel account (free tier sufficient)
- [ ] 20 slides already tiled on uni PC at: `D:\Data\pathology_tiles\` (or equivalent)
- [ ] SSH/RustDesk access to uni PC (IP: `100.116.210.90`, user: `2005348`)
- [ ] AWS CLI installed on uni PC (for tile upload)
- [ ] Node.js v18+ installed locally

---

## Phase 1: AWS Setup (S3 + CloudFront) ⏱️ 60-90 min

### 1.1 Create AWS Account (5 min)
- [ ] Go to [aws.amazon.com](https://aws.amazon.com)
- [ ] Sign up with credit card (billing alerts recommended)
- [ ] Enable AWS free tier

### 1.2 Create IAM User (10 min)
- [ ] IAM Console → Users → Create User
- [ ] Username: `pathology-study-backend`
- [ ] Access type: **Programmatic access only**
- [ ] Attach policies: `AmazonS3FullAccess`
- [ ] **SAVE**: Access Key ID and Secret Access Key (you won't see secret again!)

**Output needed:**
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

### 1.3 Create S3 Bucket (10 min)
- [ ] S3 Console → Create Bucket
- [ ] Bucket name: `pathology-study-tiles-<your-name>` (globally unique)
- [ ] Region: `us-east-1` (or closest to users)
- [ ] **UNCHECK** "Block all public access" ⚠️
- [ ] Confirm warning (tiles need public read)
- [ ] Enable default encryption (SSE-S3)
- [ ] Click **Create Bucket**

**Output needed:**
```
S3_BUCKET_NAME=pathology-study-tiles-<your-name>
S3_REGION=us-east-1
```

### 1.4 Configure S3 Bucket Policy (5 min)
- [ ] Go to bucket → Permissions → Bucket Policy
- [ ] Copy from: `deployment-prep/s3-bucket-policy.json`
- [ ] Replace `YOUR-BUCKET-NAME` with your actual bucket name
- [ ] Save changes

### 1.5 Upload Tiles to S3 (30-60 min depending on size)

**On Uni PC** (via RustDesk/SSH):

```bash
# Install AWS CLI (if not already)
# See: deployment-prep/aws-cli-install.sh

# Configure AWS credentials
aws configure
# Enter Access Key ID: AKIA...
# Enter Secret Access Key: ...
# Default region: us-east-1
# Default output: json

# Upload tiles (adjust paths as needed)
cd D:\Data\pathology_tiles\  # Or wherever tiles are stored
aws s3 sync . s3://YOUR-BUCKET-NAME/slides/ \
  --exclude "*.dzi" \
  --include "*/files/*" \
  --only-show-errors \
  --no-progress
```

**Expected structure in S3:**
```
s3://YOUR-BUCKET-NAME/slides/
  ├── slide_001/files/0/0_0.jpeg
  ├── slide_001/files/1/0_0.jpeg
  ├── slide_002/files/0/0_0.jpeg
  └── ...
```

- [ ] Verify tiles uploaded: Check S3 console, should see `slides/` prefix
- [ ] Note total objects uploaded (should be thousands per slide)
- [ ] Estimate: ~5GB per slide × 20 slides = ~100GB total

### 1.6 Create CloudFront Distribution (15 min)
- [ ] CloudFront Console → Create Distribution
- [ ] Origin domain: Select your S3 bucket
- [ ] Origin access: **Origin access control settings**
  - [ ] Create new OAC: `pathology-study-oac`
  - [ ] Signing behavior: `Sign requests`
- [ ] Viewer protocol policy: **HTTPS only**
- [ ] Cache policy: `CachingOptimized`
- [ ] Price class: `Use all edge locations` (or North America + Europe to save $)
- [ ] Click **Create Distribution**
- [ ] **WAIT 10-15 minutes** for status to change to "Deployed"

### 1.7 Update S3 Bucket Policy for CloudFront (5 min)
- [ ] Go to CloudFront distribution → Origins tab
- [ ] Click origin → Edit → **Copy policy** button
- [ ] Go to S3 bucket → Permissions → Bucket Policy
- [ ] **Replace** existing policy with CloudFront policy
- [ ] Save changes

### 1.8 Test CloudFront (5 min)
- [ ] Copy CloudFront distribution URL: `https://d1234abcd5678.cloudfront.net`
- [ ] Test URL: `https://d1234abcd5678.cloudfront.net/slides/slide_001/files/14/0_0.jpeg`
- [ ] Should see a tile image (JPEG)
- [ ] If 403 error: Check S3 bucket policy was updated

**Output needed:**
```
CLOUDFRONT_URL=https://d1234abcd5678.cloudfront.net
```

---

## Phase 2: Backend Deployment (Railway) ⏱️ 45-60 min

### 2.1 Create Railway Account (5 min)
- [ ] Go to [railway.app](https://railway.app)
- [ ] Sign up with GitHub
- [ ] Click **New Project** → **Deploy from GitHub repo**
- [ ] Select: `pathologist_user_study_tool` repository

### 2.2 Add PostgreSQL Database (5 min)
- [ ] In Railway project: **+ New** → **Database** → **Add PostgreSQL**
- [ ] Railway auto-provisions database
- [ ] Note: `DATABASE_URL` is auto-provided as env var

### 2.3 Configure Environment Variables (10 min)
- [ ] Railway project → **Variables** tab
- [ ] Add variables from: `deployment-prep/env.production.backend`
- [ ] Generate JWT_SECRET:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Copy/paste all required vars (see template)

**Required variables:**
- `DATABASE_URL` (auto-provided by Railway)
- `JWT_SECRET` (generate with command above)
- `PORT=3001`
- `NODE_ENV=production`
- `FRONTEND_URL=https://your-app.vercel.app` (update after Vercel deployment)
- `AWS_ACCESS_KEY_ID` (from Phase 1.2)
- `AWS_SECRET_ACCESS_KEY` (from Phase 1.2)
- `S3_BUCKET_NAME` (from Phase 1.3)
- `CLOUDFRONT_URL` (from Phase 1.8)

### 2.4 Configure Build Settings (10 min)

**Option A: Add Procfile to repo root** (Recommended)
- [ ] Copy `deployment-prep/Procfile` to repo root
- [ ] Commit and push:
  ```bash
  cp deployment-prep/Procfile .
  git add Procfile
  git commit -m "Add Procfile for Railway deployment"
  git push origin main
  ```

**Option B: Configure in Railway dashboard**
- [ ] Settings → Build & Deploy
- [ ] Root directory: `backend`
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`

### 2.5 Deploy Backend (5 min)
- [ ] Railway auto-deploys on push (or click **Deploy** manually)
- [ ] Watch **Deploy Logs** tab for progress
- [ ] Wait for "✓ Deployment successful" (~2-5 min)

### 2.6 Run Database Migrations (15 min)

**Option A: Railway CLI** (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link  # Select your project

# Run migrations
railway run psql $DATABASE_URL -f backend/src/db/migrations/001_initial.sql
railway run psql $DATABASE_URL -f backend/src/db/migrations/002_add_dzi_level_to_events.sql
railway run psql $DATABASE_URL -f backend/src/db/migrations/003_add_notes_column.sql
```

**Option B: Railway Dashboard → Database → Query**
- [ ] Copy contents of `001_initial.sql`
- [ ] Paste into query editor and run
- [ ] Repeat for `002_add_dzi_level_to_events.sql`
- [ ] Repeat for `003_add_notes_column.sql`

### 2.7 Test Backend Health (5 min)
- [ ] Railway → Settings → Domains
- [ ] Copy provided domain: `your-app.up.railway.app`
- [ ] Test: `https://your-app.up.railway.app/health`
- [ ] Expected response: `{"status":"ok","timestamp":"...","database":"connected"}`

**Output needed:**
```
BACKEND_URL=https://your-app.up.railway.app
```

---

## Phase 3: Frontend Deployment (Vercel) ⏱️ 30-40 min

### 3.1 Create Vercel Account (5 min)
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Sign up with GitHub
- [ ] Click **Add New Project**

### 3.2 Import Repository (5 min)
- [ ] Select: `pathologist_user_study_tool` repository
- [ ] Framework preset: **Vite** (auto-detected)
- [ ] Root directory: `.` (project root)
- [ ] Build command: `npm run build` (auto-detected)
- [ ] Output directory: `dist` (auto-detected)
- [ ] Click **Deploy** (will deploy with default settings)

### 3.3 Configure Environment Variables (10 min)
- [ ] Vercel project → **Settings** → **Environment Variables**
- [ ] Add variable:
  - Name: `VITE_API_URL`
  - Value: `https://your-app.up.railway.app` (from Phase 2.7)
  - Environment: **Production, Preview, Development** (select all)
- [ ] Click **Save**

### 3.4 Redeploy with Environment Variable (5 min)
- [ ] Go to **Deployments** tab
- [ ] Latest deployment → **⋯ (three dots)** → **Redeploy**
- [ ] Wait for deployment to complete (~1-2 min)

### 3.5 Update Railway CORS (5 min)
- [ ] Copy Vercel production URL: `https://your-app.vercel.app`
- [ ] Go back to Railway → **Variables** tab
- [ ] Update `FRONTEND_URL` to: `https://your-app.vercel.app`
- [ ] Railway auto-redeploys (~2 min)

### 3.6 Test Frontend (5 min)
- [ ] Visit: `https://your-app.vercel.app`
- [ ] Should see login page
- [ ] Check browser console (F12) for errors
- [ ] Should NOT see CORS errors
- [ ] Expected: Login form rendered, no red errors

**Output needed:**
```
FRONTEND_URL=https://your-app.vercel.app
```

---

## Phase 4: Database Seeding ⏱️ 30-40 min

### 4.1 Create Test Users (10 min)

**Using Railway CLI:**
```bash
# From repo root
cd backend
railway run npx ts-node scripts/create-test-users.ts
```

**Manual (via Railway Query Editor):**
```sql
-- Generate bcrypt hash locally first:
-- node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(h => console.log(h))"

INSERT INTO users (username, password_hash, role) VALUES
  ('admin', '$2b$10$...hash...', 'admin'),
  ('pathologist1', '$2b$10$...hash...', 'pathologist'),
  ('pathologist2', '$2b$10$...hash...', 'pathologist');
```

- [ ] Verify users created:
  ```sql
  SELECT username, role FROM users;
  ```

**Test credentials created:**
- Admin: `admin` / `admin123`
- Pathologist 1: `pathologist1` / `patho123`
- Pathologist 2: `pathologist2` / `patho123`

### 4.2 Seed Slide Metadata (20 min)

**Option A: Use seed script** (Recommended)
```bash
# From repo root
cd backend

# Update seed-slides.ts with your slide IDs and S3 paths
# Then run:
railway run npx ts-node scripts/seed-slides.ts
```

**Option B: Manual SQL Insert** (For each slide)

You'll need to:
1. Get manifest JSON from each slide's `manifest.json` file
2. Insert into database manually

See `deployment-prep/seed-slides-manual.sql` for template.

**Blocker:** Manifest files are on uni PC, not on VPS. You'll need to:
- [ ] Copy manifest JSON from uni PC tiled slides
- [ ] Either transfer to VPS or paste directly into Railway query editor

### 4.3 Verify Seed Data (5 min)
```sql
-- Check users
SELECT username, role FROM users;

-- Check slides
SELECT slide_id, s3_key_prefix FROM slides;

-- Check no sessions yet
SELECT COUNT(*) FROM sessions;  -- Should be 0
```

---

## Phase 5: End-to-End Testing ⏱️ 30 min

### 5.1 Health Checks (5 min)
- [ ] Backend health: `https://your-app.up.railway.app/health`
  - Expected: `{"status":"ok",...}`
- [ ] Frontend loads: `https://your-app.vercel.app`
  - Expected: Login page appears

### 5.2 Admin Login Test (5 min)
- [ ] Visit: `https://your-app.vercel.app`
- [ ] Login: `admin` / `admin123`
- [ ] Expected: Redirected to viewer or admin dashboard
- [ ] Check browser console: No errors

### 5.3 Pathologist Login Test (5 min)
- [ ] Logout (or use incognito window)
- [ ] Login: `pathologist1` / `patho123`
- [ ] Expected: Viewer loads, slide queue appears
- [ ] Check browser console: No errors

### 5.4 Slide Loading Test (10 min)
- [ ] After pathologist login, first slide should auto-load
- [ ] Expected: Slide image appears in viewer
- [ ] Pan/zoom with mouse/keyboard
- [ ] Open DevTools (F12) → Network tab
- [ ] Filter: Images
- [ ] Expected: Tile requests go to `*.cloudfront.net`
- [ ] Expected: Tiles load in < 500ms (check timing column)
- [ ] Expected: No 403/404 errors

### 5.5 Event Upload Test (5 min)
- [ ] Click on slide (marking cell clicks)
- [ ] Pan with arrow keys
- [ ] Check browser console: No errors
- [ ] Check Railway logs: Should see `[API] Events uploaded` messages
- [ ] Query database:
  ```sql
  SELECT COUNT(*) FROM events;  -- Should be > 0
  ```

### 5.6 Session Completion Test (5 min)
- [ ] Select diagnosis label (Normal/Benign/Malignant)
- [ ] Click "Next Slide"
- [ ] Expected: Next slide loads
- [ ] Query database:
  ```sql
  SELECT * FROM sessions WHERE completed_at IS NOT NULL;
  ```
- [ ] Should see completed session

---

## Phase 6: Production Readiness ⏱️ 15 min

### 6.1 Cost Monitoring (5 min)
- [ ] AWS Billing → Budgets → Create Budget
  - Type: Cost budget
  - Amount: $30/month
  - Alerts: 80% and 100%
- [ ] Railway → Usage tab: Check current usage
- [ ] Vercel → Usage tab: Check bandwidth

### 6.2 Error Monitoring (5 min)
- [ ] Railway → Project → **Notifications**
  - Enable: Deployment failures
  - Enable: Service crashes
- [ ] Save notification email

### 6.3 Backup Plan (5 min)
- [ ] Railway → PostgreSQL → Connect tab
- [ ] Copy `DATABASE_URL` to secure location (password manager)
- [ ] Test backup command:
  ```bash
  railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
  ```

---

## Time Estimates Summary

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | AWS Setup (S3 + CloudFront) | 60-90 min |
| 2 | Backend Deployment (Railway) | 45-60 min |
| 3 | Frontend Deployment (Vercel) | 30-40 min |
| 4 | Database Seeding | 30-40 min |
| 5 | End-to-End Testing | 30 min |
| 6 | Production Readiness | 15 min |
| **Total** | **First-time deployment** | **3.5-4.5 hours** |

**Note:** Tile upload time (Phase 1.5) can vary significantly (30 min - 2 hours) depending on:
- Number of slides (20 slides)
- Tile count per slide (~5-10k tiles each)
- Upload bandwidth from uni PC
- S3 region distance

**Recommendation:** Start tile upload first (Phase 1.5) and continue with other phases while it runs in background.

---

## Important URLs to Save

```bash
# AWS
S3_BUCKET_NAME=pathology-study-tiles-<your-name>
S3_REGION=us-east-1
CLOUDFRONT_URL=https://d1234abcd5678.cloudfront.net

# Railway (Backend)
BACKEND_URL=https://your-app.up.railway.app
DATABASE_URL=postgresql://postgres:...@...railway.app:5432/railway

# Vercel (Frontend)
FRONTEND_URL=https://your-app.vercel.app

# AWS IAM
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Security
JWT_SECRET=...hex...
```

**⚠️ Save these in a secure location (password manager)!**

---

## Rollback Plan

If something goes wrong:

1. **Backend issues:**
   - [ ] Railway → Deployments → Revert to previous deployment
   - [ ] Check logs for errors

2. **Frontend issues:**
   - [ ] Vercel → Deployments → Revert to previous deployment
   - [ ] Check browser console

3. **Database issues:**
   - [ ] Restore from backup: `railway run psql $DATABASE_URL < backup.sql`

4. **Critical failure:**
   - [ ] Pause Railway service (stops billing)
   - [ ] Debug locally with `npm run dev`
   - [ ] Redeploy when fixed

---

## Post-Deployment Tasks

After successful deployment:

- [ ] Document production URLs in README
- [ ] Create pathologist user accounts (real usernames)
- [ ] Upload all study slides (if not done in Phase 1)
- [ ] Seed all slide metadata
- [ ] Conduct pilot study with 2-3 test pathologists
- [ ] Monitor costs weekly for first month
- [ ] Set up weekly database backups (cron job)

---

## Support Resources

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Vercel Docs: [vercel.com/docs](https://vercel.com/docs)
- AWS S3 Docs: [docs.aws.amazon.com/s3](https://docs.aws.amazon.com/s3)
- CloudFront Docs: [docs.aws.amazon.com/cloudfront](https://docs.aws.amazon.com/cloudfront)

---

## Completion Checklist

Before declaring "production ready":

- [ ] All phases completed without errors
- [ ] All tests passed (Phase 5)
- [ ] Admin can login and access dashboard
- [ ] Pathologists can login and view slides
- [ ] Tiles load from CloudFront (< 500ms)
- [ ] Events upload successfully to database
- [ ] Sessions complete and labels save
- [ ] Cost monitoring alerts configured
- [ ] Database backup strategy in place
- [ ] Documentation updated with production URLs

**Status:** Ready for pilot study! 🚀
