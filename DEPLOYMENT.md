# Deployment Guide: Local Prototype → Production

**Target Audience:** Non-web-developers deploying for the first time  
**Estimated Time:** 4-6 hours (can be done over a weekend)  
**Prerequisites:** GitHub account, AWS account, basic command-line familiarity

---

## 📋 Overview

This guide walks you through deploying the pathologist user study application from your local machine to production. The system has three main components:

1. **Frontend** (Vercel) - The web interface pathologists use
2. **Backend** (Railway/Render) - The API server and database
3. **Tile Storage** (AWS S3 + CloudFront) - The slide images

```
Pathologist Browser
  ↓ HTTPS
Vercel (Frontend) ← TypeScript + OpenSeadragon
  ↓ API calls
Railway (Backend) ← Express + PostgreSQL
  ↓ metadata only
AWS S3 + CloudFront ← DZI tiles (images)
```

**Cost Estimate:** $15-35/month during active study period (see [Cost Breakdown](#cost-breakdown) section)

---

## ✅ Pre-Deployment Checklist

Before starting, ensure you have:

- [ ] **GitHub account** with your code pushed to a repository
- [ ] **AWS account** (free tier available for 12 months)
- [ ] **Railway account** (or Render account as alternative)
- [ ] **Vercel account** (free tier sufficient)
- [ ] **Node.js installed** locally (v18+ recommended)
- [ ] **Docker installed** (for local PostgreSQL testing, optional)
- [ ] **All tiles generated** and stored in `tiles/` directory
- [ ] **Backend builds successfully** (`cd backend && npm run build`)
- [ ] **Frontend builds successfully** (`npm run build`)

---

## Step 1: Prepare Production Builds Locally

**Time:** 15 minutes

Before deploying, verify everything builds correctly:

### 1.1 Build Backend

```bash
cd backend
npm install
npm run build
```

**Expected output:** `dist/` directory created with compiled JavaScript files.

**If errors occur:**
- Check TypeScript errors: `npm run build` will show them
- Ensure all dependencies installed: `npm install`
- Check `backend/tsconfig.json` is valid

### 1.2 Build Frontend

```bash
# From project root
npm install
npm run build
```

**Expected output:** `dist/` directory created with HTML, CSS, and JavaScript bundles.

**If errors occur:**
- Check for missing dependencies
- Verify `vite.config.ts` is correct
- Check browser console for runtime errors

### 1.3 Test Locally (Optional but Recommended)

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
npm run dev
```

Visit `http://localhost:5173` and verify:
- Login page loads
- Can login with test credentials
- Viewer loads a slide
- Admin dashboard accessible (if admin account exists)

**Note:** This requires a local PostgreSQL database. If you don't have one set up, you can skip this step and test directly in production.

---

## Step 2: AWS Setup (S3 + CloudFront)

**Time:** 45-60 minutes

### 2.1 Create AWS Account

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Follow the signup process (requires credit card, but free tier available)
4. **Important:** Enable billing alerts to avoid surprises (see [Cost Monitoring](#cost-monitoring))

### 2.2 Create IAM User for Programmatic Access

**Why:** Your backend needs AWS credentials to access S3. Never use your root AWS account credentials.

1. Go to **IAM Console** → **Users** → **Create User**
2. Username: `pathology-study-backend`
3. **Access Type:** Select "Programmatic access" (not console access)
4. Click **Next: Permissions**
5. Click **Attach policies directly**
6. Search and select:
   - `AmazonS3FullAccess` (or create custom policy for just your bucket)
   - `CloudFrontFullAccess` (optional, only if you need to invalidate cache)
7. Click **Next: Tags** (skip if not needed)
8. Click **Create User**
9. **CRITICAL:** Copy the **Access Key ID** and **Secret Access Key** immediately
   - You won't be able to see the secret key again
   - Save these securely (you'll need them for Railway/Render)

### 2.3 Create S3 Bucket

1. Go to **S3 Console** → **Create Bucket**
2. **Bucket Name:** `pathology-study-tiles` (must be globally unique, add your name/org)
3. **AWS Region:** Choose closest to your users (e.g., `us-east-1` for US East)
4. **Object Ownership:** ACLs disabled (recommended)
5. **Block Public Access:** **Uncheck "Block all public access"** (tiles need to be publicly readable)
   - Check the warning box to confirm
6. **Bucket Versioning:** Disable (not needed for this project)
7. **Default Encryption:** Enable (SSE-S3 is fine)
8. Click **Create Bucket**

### 2.4 Configure S3 Bucket Permissions

1. Click on your bucket name
2. Go to **Permissions** tab
3. Scroll to **Bucket Policy**
4. Click **Edit** and paste this policy (replace `YOUR-BUCKET-NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

5. Click **Save Changes**

**Why:** This allows CloudFront (and anyone with the URL) to read tiles. For a research study with anonymized slides, this is acceptable. If you need security, use signed URLs instead (more complex).

### 2.5 Upload Tiles to S3

**Option A: AWS Console (Manual - Good for Testing)**

1. Go to your S3 bucket
2. Click **Upload**
3. Navigate to your `tiles/` directory
4. Upload entire directory structure:
   - `tiles/test_slide_files/` → `slides/test_slide/files/`
   - `tiles/CRC_test_005_files/` → `slides/CRC_test_005/files/`
   - etc.
5. **Important:** Maintain the directory structure: `slides/{slide_id}/files/{level}/{x}_{y}.jpeg`

**Option B: AWS CLI (Automated - Recommended for Production)**

1. Install AWS CLI: [aws.amazon.com/cli](https://aws.amazon.com/cli)
2. Configure credentials:
   ```bash
   aws configure
   # Enter your Access Key ID and Secret Access Key from Step 2.2
   # Default region: us-east-1 (or your chosen region)
   # Default output: json
   ```
3. Upload tiles:
   ```bash
   # From project root
   aws s3 sync tiles/ s3://YOUR-BUCKET-NAME/slides/ \
     --exclude "*.dzi" \
     --include "*/files/**"
   ```

**Note:** The `.dzi` files are not needed in S3 (manifests are stored in database). Only upload the `*_files/` directories.

**Expected time:** 30-60 minutes depending on number of slides and upload speed.

### 2.6 Create CloudFront Distribution

1. Go to **CloudFront Console** → **Create Distribution**
2. **Origin Domain:** Select your S3 bucket (e.g., `pathology-study-tiles.s3.us-east-1.amazonaws.com`)
3. **Origin Access:** Select "Origin access control settings (recommended)"
   - Click **Create control setting**
   - Name: `pathology-study-oac`
   - Signing behavior: `Sign requests`
   - Click **Create**
   - Select the control setting you just created
4. **Viewer Protocol Policy:** HTTPS only
5. **Allowed HTTP Methods:** GET, HEAD, OPTIONS
6. **Cache Policy:** CachingOptimized (or create custom with 24hr TTL)
7. **Price Class:** Use all edge locations (or "Use only North America and Europe" to save money)
8. Click **Create Distribution**

**Wait 10-15 minutes** for distribution to deploy (status will change from "In Progress" to "Deployed").

### 2.7 Update S3 Bucket Policy for CloudFront

After CloudFront distribution is created:

1. Go to your **CloudFront distribution** → **Origins** tab
2. Click on your origin → **Edit**
3. Scroll to **Origin access control** → Click **Copy policy**
4. Go to your **S3 bucket** → **Permissions** → **Bucket Policy** → **Edit**
5. Replace the policy with the copied CloudFront policy
6. Click **Save Changes**

### 2.8 Get CloudFront Distribution URL

1. Go to **CloudFront Console** → Your distribution
2. Copy the **Distribution domain name** (e.g., `d1234abcd5678.cloudfront.net`)
3. **Save this URL** - you'll need it for backend environment variables

**Test:** Visit `https://YOUR-DISTRIBUTION-URL.cloudfront.net/slides/test_slide/files/14/0_0.jpeg` in a browser. You should see a tile image.

---

## Step 3: Backend Deployment (Railway)

**Time:** 30-45 minutes

**Why Railway?** Easy PostgreSQL setup, good free tier, simple deployment. Alternative: Render (similar process).

### 3.1 Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended) or email
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your repository
5. Railway will detect it's a Node.js project

### 3.2 Add PostgreSQL Database

1. In your Railway project, click **+ New** → **Database** → **Add PostgreSQL**
2. Railway automatically creates a PostgreSQL database
3. **Important:** Copy the `DATABASE_URL` connection string (you'll need it)
   - Format: `postgresql://postgres:PASSWORD@HOST:PORT/railway`
   - This is auto-provided as an environment variable

### 3.3 Configure Environment Variables

1. Go to your Railway project → **Variables** tab
2. Add the following variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `DATABASE_URL` | (auto-provided) | Railway sets this automatically |
| `JWT_SECRET` | (generate random string) | See below for generation |
| `PORT` | `3001` | Or let Railway auto-assign |
| `NODE_ENV` | `production` | |
| `FRONTEND_URL` | `https://your-app.vercel.app` | You'll update this after Vercel deployment |
| `AWS_ACCESS_KEY_ID` | (from Step 2.2) | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | (from Step 2.2) | IAM user secret key |
| `S3_BUCKET_NAME` | `pathology-study-tiles` | Your S3 bucket name |
| `CLOUDFRONT_URL` | `https://d1234abcd5678.cloudfront.net` | Your CloudFront distribution URL |

**Generate JWT_SECRET:**
```bash
# On your local machine
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste as `JWT_SECRET` value.

### 3.4 Configure Build Settings

1. Go to **Settings** → **Build & Deploy**
2. **Root Directory:** Leave empty (or set to `backend/` if your repo root is not the backend)
3. **Build Command:** `npm run build` (or `cd backend && npm run build` if root directory is not set)
4. **Start Command:** `npm start` (or `cd backend && npm start`)
5. **Watch Paths:** Leave default (Railway auto-detects)

### 3.5 Deploy Backend

1. Railway will automatically deploy when you push to GitHub
2. Or click **Deploy** button to trigger manual deployment
3. Watch the **Deploy Logs** tab for build progress
4. **Wait for deployment to complete** (2-5 minutes)

### 3.6 Run Database Migrations

**Option A: Via Railway CLI (Recommended)**

1. Install Railway CLI: [docs.railway.app/cli](https://docs.railway.app/cli)
2. Login: `railway login`
3. Link project: `railway link` (select your project)
4. Run migrations:
   ```bash
   railway run psql $DATABASE_URL < backend/src/db/migrations/001_initial.sql
   railway run psql $DATABASE_URL -f backend/src/db/migrations/002_add_dzi_level_to_events.sql
   railway run psql $DATABASE_URL -f backend/src/db/migrations/003_add_notes_column.sql
   ```

**Option B: Via Railway Dashboard**

1. Go to your PostgreSQL database → **Connect** tab
2. Copy the connection string
3. Use a PostgreSQL client (e.g., [pgAdmin](https://www.pgadmin.org/)) or Railway's built-in query editor
4. Run the SQL from `backend/src/db/migrations/001_initial.sql`
5. Then run `002_add_dzi_level_to_events.sql` and `003_add_notes_column.sql`

### 3.7 Test Backend

1. Go to your Railway project → **Settings** → **Domains**
2. Railway provides a default domain (e.g., `your-app.up.railway.app`)
3. Test health endpoint: `https://your-app.up.railway.app/health`
   - Should return: `{"status":"ok"}`
4. **Save this backend URL** - you'll need it for Vercel

**If errors occur:**
- Check **Deploy Logs** for build errors
- Check **Logs** tab for runtime errors
- Verify all environment variables are set correctly
- Test database connection: Check Railway PostgreSQL logs

---

## Step 4: Frontend Deployment (Vercel)

**Time:** 20-30 minutes

### 4.1 Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (recommended)
3. Click **Add New Project**

### 4.2 Import GitHub Repository

1. Select your repository
2. Vercel will auto-detect it's a Vite project
3. **Framework Preset:** Vite (auto-detected)
4. **Root Directory:** Leave as `.` (project root)
5. **Build Command:** `npm run build` (auto-detected)
6. **Output Directory:** `dist` (auto-detected)
7. Click **Deploy**

### 4.3 Configure Environment Variables

1. Go to your project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://your-app.up.railway.app` (your Railway backend URL from Step 3.7)
   - **Environment:** Production, Preview, Development (select all)
3. Click **Save**

### 4.4 Redeploy After Adding Environment Variable

1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on latest deployment → **Redeploy**
3. Wait for deployment to complete (1-2 minutes)

### 4.5 Get Production URL

1. Vercel provides a default domain (e.g., `your-app.vercel.app`)
2. **Save this URL** - this is your production frontend
3. **Update Railway `FRONTEND_URL`:** Go back to Railway → Variables → Update `FRONTEND_URL` to your Vercel URL
4. **Redeploy Railway backend** (so CORS allows your Vercel domain)

### 4.6 Test Frontend

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. You should see the login page
3. **Note:** You won't be able to login yet (no users in database - see Step 5)

**If errors occur:**
- Check browser console (F12) for errors
- Verify `VITE_API_URL` is set correctly
- Check Vercel build logs for compilation errors
- Ensure Railway backend is accessible (test `/health` endpoint)

---

## Step 5: Database Seeding

**Time:** 15-20 minutes

### 5.1 Create Admin Account

**Option A: Via Railway CLI**

```bash
# From project root
cd backend
railway run npx ts-node scripts/create-test-users.ts
```

**Option B: Via SQL (Direct Database Access)**

1. Connect to Railway PostgreSQL (see Step 3.6)
2. Run this SQL (replace `YOUR_PASSWORD_HASH` with bcrypt hash):

```sql
-- Generate bcrypt hash locally first:
-- node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(h => console.log(h))"

INSERT INTO users (username, password_hash, role) 
VALUES ('admin', 'YOUR_PASSWORD_HASH', 'admin');
```

**Generate bcrypt hash:**
```bash
cd backend
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(h => console.log(h))"
```
Copy the output and use it in the SQL above.

### 5.2 Create Test Pathologist Accounts

Use the same method as Step 5.1, or use the `create-test-users.ts` script:

```bash
cd backend
railway run npx ts-node scripts/create-test-users.ts
```

This creates:
- `admin` / `admin123`
- `pathologist1` / `patho123`
- `pathologist2` / `patho123`

### 5.3 Insert Slide Metadata

**Option A: Via Script (Future - T-0007 will create this)**

```bash
# This script will be created in T-0007
railway run node scripts/seed-database.js
```

**Option B: Via SQL (Manual)**

For each slide you uploaded to S3:

```sql
INSERT INTO slides (slide_id, s3_key_prefix, manifest_json) 
VALUES (
  'test_slide',
  'slides/test_slide',
  '{"slide_id": "test_slide", "level0_width": 147184, "level0_height": 49960, ...}'::jsonb
);
```

**Get manifest JSON:** Copy contents of `tiles/test_slide_files/manifest.json` and paste as JSONB.

**Note:** This is tedious for many slides. T-0007 will create an automated script.

### 5.4 Test Login

1. Visit your Vercel frontend URL
2. Login with `admin` / `admin123`
3. You should see the admin dashboard (or viewer if role routing isn't working)
4. Login with `pathologist1` / `patho123`
5. You should see the viewer with slide queue

**If login fails:**
- Check Railway backend logs for errors
- Verify JWT_SECRET is set correctly
- Check database has users (query `SELECT * FROM users;`)
- Verify CORS allows your Vercel domain

---

## Step 6: Validation & Testing

**Time:** 30 minutes

### 6.1 Smoke Tests

Run these tests to verify everything works:

1. **Health Check:**
   - Visit: `https://your-backend.railway.app/health`
   - Expected: `{"status":"ok"}`

2. **Frontend Loads:**
   - Visit: `https://your-app.vercel.app`
   - Expected: Login page appears

3. **Admin Login:**
   - Login: `admin` / `admin123`
   - Expected: Admin dashboard (or viewer if routing not implemented)

4. **Pathologist Login:**
   - Login: `pathologist1` / `patho123`
   - Expected: Viewer loads, slide queue appears

5. **Slide Loads:**
   - After login, first slide should load automatically
   - Expected: Slide image appears, no broken tile images

6. **Tiles Load from CloudFront:**
   - Open browser DevTools (F12) → Network tab
   - Pan/zoom in viewer
   - Expected: Tile requests go to `*.cloudfront.net` domain
   - Expected: Tiles load within 500ms

7. **Event Upload:**
   - Click on slide, pan with arrows
   - Expected: No errors in browser console
   - Check Railway logs: Should see `[API] Events uploaded` messages

8. **CSV Export (Admin):**
   - Login as admin
   - Click "Download CSV Export"
   - Expected: CSV file downloads with events

### 6.2 Common Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| **CORS Error** | Browser console: "CORS policy blocked" | Update Railway `FRONTEND_URL` env var to your Vercel URL, redeploy |
| **401 Unauthorized** | Login fails | Check `JWT_SECRET` is set, verify user exists in database |
| **Tiles Not Loading** | Broken images in viewer | Verify CloudFront URL is correct, check S3 bucket policy allows public read |
| **500 Server Error** | Backend crashes | Check Railway logs, verify database migrations ran, check env vars |
| **Database Connection Error** | Backend can't connect to DB | Verify `DATABASE_URL` is set correctly in Railway |
| **Build Fails** | Deployment doesn't complete | Check build logs, verify `package.json` has all dependencies |

### 6.3 Performance Checks

1. **Tile Load Time:**
   - Open DevTools → Network tab
   - Filter by "jpeg" or "image"
   - Pan/zoom in viewer
   - **Target:** Tiles load in < 500ms (p95)

2. **API Response Time:**
   - Open DevTools → Network tab
   - Filter by "api"
   - Perform actions (login, load slide, upload events)
   - **Target:** API calls complete in < 200ms

3. **CloudFront Cache Hit Rate:**
   - Go to CloudFront Console → Your distribution → Metrics
   - After initial load, cache hit rate should be > 90%

---

## Cost Breakdown

### Monthly Costs (During Active Study)

| Service | Cost | Notes |
|---------|------|-------|
| **Vercel** | $0 | Free tier sufficient for 5-10 users |
| **Railway** | $5-10 | Starter tier includes PostgreSQL |
| **AWS S3** | ~$5-10 | 200 slides × 5GB = ~1TB storage |
| **CloudFront** | ~$5-15 | First 1TB free, then $0.085/GB |
| **Total** | **$15-35/month** | During active study period |

### AWS Free Tier (First 12 Months)

- **S3:** 5GB storage free
- **CloudFront:** 1TB data transfer free
- **Total AWS savings:** ~$20-30/month for first year

### Cost Optimization Tips

1. **Monitor Usage:**
   - Set up AWS billing alerts (threshold: $20/month)
   - Check Railway usage dashboard weekly
   - Archive old slides to cheaper storage after study

2. **Reduce Costs:**
   - Use CloudFront caching (reduces S3 reads)
   - Choose "North America and Europe" price class in CloudFront
   - Delete unused slides from S3 after study completes

3. **Scale Down After Study:**
   - Pause Railway backend when not in use
   - Archive S3 data to Glacier (cheaper long-term storage)
   - Keep Vercel frontend (free tier)

---

## Cost Monitoring

### AWS Billing Alerts

1. Go to **AWS Billing Console** → **Budgets**
2. Click **Create Budget**
3. **Budget Type:** Cost budget
4. **Amount:** $30/month (or your threshold)
5. **Alerts:** Email when 80% and 100% of budget reached
6. Click **Create**

### Railway Usage

1. Go to Railway dashboard → **Usage** tab
2. Monitor:
   - Compute hours
   - Database storage
   - Data transfer

### Vercel Usage

1. Go to Vercel dashboard → **Usage** tab
2. Free tier includes:
   - 100GB bandwidth/month
   - Unlimited deployments
   - Sufficient for this project

---

## Maintenance & Updates

### Updating Code

1. **Make changes locally**
2. **Test locally** (if possible)
3. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Update feature X"
   git push origin main
   ```
4. **Vercel auto-deploys** (within 1-2 minutes)
5. **Railway auto-deploys** (within 2-5 minutes)

### Database Migrations

When adding new migrations:

1. Create migration file: `backend/src/db/migrations/004_new_feature.sql`
2. Run on Railway:
   ```bash
   railway run psql $DATABASE_URL -f backend/src/db/migrations/004_new_feature.sql
   ```

### Adding New Slides

1. Generate tiles locally: `python src/tiler/wsi_tiler.py slide.svs`
2. Upload to S3: `aws s3 sync tiles/slide_files/ s3://bucket/slides/slide/files/`
3. Insert metadata into database (see Step 5.3)

### Monitoring

**Check logs regularly:**
- **Railway:** Project → Logs tab
- **Vercel:** Project → Deployments → Click deployment → View logs
- **CloudFront:** Distribution → Monitoring tab

**Set up alerts:**
- Railway: Email notifications for deployment failures
- AWS: CloudWatch alarms for S3/CloudFront errors

---

## Troubleshooting

### Backend Won't Deploy

**Symptoms:** Railway build fails, deployment doesn't start

**Fixes:**
1. Check build logs for TypeScript errors
2. Verify `package.json` has all dependencies
3. Check `tsconfig.json` is valid
4. Ensure `backend/` directory structure is correct
5. Try building locally first: `cd backend && npm run build`

### Frontend Won't Deploy

**Symptoms:** Vercel build fails, white screen in browser

**Fixes:**
1. Check Vercel build logs for errors
2. Verify `VITE_API_URL` environment variable is set
3. Check browser console (F12) for runtime errors
4. Ensure `vite.config.ts` is correct
5. Try building locally: `npm run build`

### Database Connection Errors

**Symptoms:** Backend logs show "connection refused" or "authentication failed"

**Fixes:**
1. Verify `DATABASE_URL` is set correctly in Railway
2. Check Railway PostgreSQL is running (not paused)
3. Verify database migrations ran successfully
4. Test connection: `railway run psql $DATABASE_URL -c "SELECT 1;"`

### Tiles Not Loading

**Symptoms:** Broken images in viewer, 403/404 errors in browser console

**Fixes:**
1. Verify CloudFront distribution is deployed (not "In Progress")
2. Check S3 bucket policy allows public read
3. Verify CloudFront origin access control is configured
4. Test tile URL directly: `https://cloudfront-url/slides/slide/files/14/0_0.jpeg`
5. Check S3 bucket structure matches expected: `slides/{slide_id}/files/{level}/{x}_{y}.jpeg`

### CORS Errors

**Symptoms:** Browser console: "CORS policy blocked", API calls fail

**Fixes:**
1. Update Railway `FRONTEND_URL` environment variable to your Vercel URL
2. Redeploy Railway backend (so CORS middleware uses new URL)
3. Verify CORS middleware in `backend/src/index.ts` allows your Vercel domain
4. Check browser console for exact CORS error message

### Login Fails

**Symptoms:** "Invalid credentials" error, 401 responses

**Fixes:**
1. Verify user exists in database: `SELECT * FROM users;`
2. Check `JWT_SECRET` is set correctly in Railway
3. Verify password hash was generated correctly (bcrypt)
4. Check Railway backend logs for authentication errors
5. Test with known-good credentials (create new user via SQL if needed)

---

## Next Steps After Deployment

1. **Complete T-0008 (Production Readiness):**
   - Add error handling
   - Add loading spinners
   - Add rate limiting
   - Create user documentation

2. **Test with Real Users:**
   - Have 1-2 pathologists test the system
   - Gather feedback
   - Fix any issues

3. **Scale Up:**
   - Add more pathologist accounts
   - Upload all study slides
   - Begin data collection

4. **Monitor:**
   - Check costs weekly
   - Review error logs
   - Monitor performance

---

## Alternative: Render Instead of Railway

If you prefer Render:

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. **New** → **Web Service** → Connect repository
4. **Environment:** Node
5. **Build Command:** `cd backend && npm install && npm run build`
6. **Start Command:** `cd backend && npm start`
7. Add PostgreSQL database: **New** → **PostgreSQL**
8. Configure environment variables (same as Railway)
9. Deploy

**Render differences:**
- Slightly different UI
- Similar pricing ($7/month for starter tier)
- PostgreSQL setup is similar

---

## Support Resources

- **Railway Docs:** [docs.railway.app](https://docs.railway.app)
- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **AWS S3 Docs:** [docs.aws.amazon.com/s3](https://docs.aws.amazon.com/s3)
- **CloudFront Docs:** [docs.aws.amazon.com/cloudfront](https://docs.aws.amazon.com/cloudfront)

---

## Summary Checklist

Before going live, verify:

- [ ] Backend deployed to Railway and accessible
- [ ] Frontend deployed to Vercel and accessible
- [ ] All tiles uploaded to S3
- [ ] CloudFront distribution deployed and serving tiles
- [ ] Database migrations run successfully
- [ ] Admin account created and can login
- [ ] Test pathologist account created and can login
- [ ] Slide metadata inserted into database
- [ ] Environment variables configured correctly
- [ ] CORS allows Vercel domain
- [ ] Tiles load from CloudFront (< 500ms)
- [ ] Events upload successfully
- [ ] CSV export works (admin)
- [ ] Billing alerts configured
- [ ] Documentation updated with production URLs

**You're ready for production!** 🚀

---

**Questions?** Check the troubleshooting section or review the project state files in `project_state/` directory.


