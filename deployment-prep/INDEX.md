# Deployment Prep Index

**Quick navigation guide for all deployment materials.**

---

## 🚀 START HERE

### If you're deploying for the first time:
1. **[README.md](README.md)** - Overview of all materials
2. **[BLOCKERS-AND-DECISIONS.md](BLOCKERS-AND-DECISIONS.md)** - What needs to be decided
3. **[00-DEPLOYMENT-CHECKLIST.md](00-DEPLOYMENT-CHECKLIST.md)** - Step-by-step guide

### If you're an experienced dev:
1. **[QUICK-START-GUIDE.md](QUICK-START-GUIDE.md)** - TL;DR version (3-4 hours)

### If you're planning budget:
1. **[COST-ESTIMATE.md](COST-ESTIMATE.md)** - Monthly costs ($15-35)

---

## 📚 Documentation (7 files)

| File | Purpose | Size | Read Time |
|------|---------|------|-----------|
| **[README.md](README.md)** | Overview & navigation | 7.7 KB | 5 min |
| **[00-DEPLOYMENT-CHECKLIST.md](00-DEPLOYMENT-CHECKLIST.md)** | Complete deployment guide | 16 KB | 20 min |
| **[BLOCKERS-AND-DECISIONS.md](BLOCKERS-AND-DECISIONS.md)** | Critical decisions | 9.9 KB | 10 min |
| **[COST-ESTIMATE.md](COST-ESTIMATE.md)** | Budget breakdown | 10 KB | 10 min |
| **[QUICK-START-GUIDE.md](QUICK-START-GUIDE.md)** | Fast-track guide | 8.3 KB | 8 min |
| **[SUMMARY.md](SUMMARY.md)** | Prep summary | 11 KB | 8 min |
| **[INDEX.md](INDEX.md)** | This file | 2.6 KB | 3 min |

---

## ⚙️ Configuration Files (6 files)

| File | Use In | Purpose |
|------|--------|---------|
| **[s3-bucket-policy.json](s3-bucket-policy.json)** | AWS Console | S3 public read policy |
| **[s3-bucket-policy-cloudfront.json](s3-bucket-policy-cloudfront.json)** | AWS Console | CloudFront OAC policy |
| **[cloudfront-config-notes.md](cloudfront-config-notes.md)** | AWS Console | CloudFront setup guide |
| **[Procfile](Procfile)** | Repo root | Railway process definition |
| **[railway.json](railway.json)** | Repo root | Railway build config (alt) |
| **[vercel.json](vercel.json)** | Repo root | Vercel config (optional) |

---

## 🔧 Environment Variables (2 files)

| File | Platform | Variables |
|------|----------|-----------|
| **[env.production.backend](env.production.backend)** | Railway | 10 variables documented |
| **[env.production.frontend](env.production.frontend)** | Vercel | 1 variable (VITE_API_URL) |

---

## 🛠️ Scripts & Tools (6 files)

| File | OS | Purpose | Run From |
|------|-----|---------|----------|
| **[upload-tiles-to-s3.sh](upload-tiles-to-s3.sh)** | Linux/Mac | Upload tiles to S3 | Uni PC |
| **[upload-tiles-to-s3.ps1](upload-tiles-to-s3.ps1)** | Windows | Upload tiles to S3 | Uni PC |
| **[aws-cli-install.sh](aws-cli-install.sh)** | Linux/Mac | Install AWS CLI | Uni PC |
| **[seed-slides-manual.sql](seed-slides-manual.sql)** | SQL | Seed slide metadata | Railway |
| **[generate-jwt-secret.sh](generate-jwt-secret.sh)** | Bash | Generate JWT secret | Local |
| **[bcrypt-hash-generator.js](bcrypt-hash-generator.js)** | Node.js | Hash passwords | Local |

---

## 📖 Reference Guides (2 files)

| File | Platform | Purpose |
|------|----------|---------|
| **[railway-commands.md](railway-commands.md)** | Railway | CLI command reference |
| **[vercel-commands.md](vercel-commands.md)** | Vercel | CLI command reference |

---

## 📊 Statistics

- **Total files:** 22
- **Total lines:** 4,054
- **Total size:** ~110 KB
- **Documentation:** 7 files (64 KB)
- **Configuration:** 6 files (16 KB)
- **Scripts:** 6 files (22 KB)
- **References:** 2 files (12 KB)

---

## 🗺️ Deployment Flow

```
1. Read BLOCKERS-AND-DECISIONS.md
   ↓
2. Create accounts (AWS, Railway, Vercel)
   ↓
3. Follow 00-DEPLOYMENT-CHECKLIST.md
   ├─ Phase 1: AWS (use upload-tiles-to-s3.sh)
   ├─ Phase 2: Railway (use Procfile + env.production.backend)
   ├─ Phase 3: Vercel (use env.production.frontend)
   ├─ Phase 4: Database (use seed-slides-manual.sql)
   └─ Phase 5: Testing
   ↓
4. Done! 🎉
```

---

## ⏱️ Time Estimates

| Task | Duration |
|------|----------|
| Read documentation | 30-45 min |
| Create accounts | 15-20 min |
| AWS setup | 60-90 min |
| Railway setup | 45-60 min |
| Vercel setup | 30-40 min |
| Database seeding | 30-40 min |
| Testing | 30 min |
| **Total** | **3.5-4.5 hours** |

**Plus:** Tile upload (30 min - 2 hours) runs in parallel

---

## 🎯 Quick Links by Task

### Setting up AWS:
- [cloudfront-config-notes.md](cloudfront-config-notes.md) - Complete guide
- [s3-bucket-policy.json](s3-bucket-policy.json) - Initial policy
- [s3-bucket-policy-cloudfront.json](s3-bucket-policy-cloudfront.json) - CloudFront policy
- [upload-tiles-to-s3.sh](upload-tiles-to-s3.sh) - Upload script (Linux/Mac)
- [upload-tiles-to-s3.ps1](upload-tiles-to-s3.ps1) - Upload script (Windows)

### Setting up Railway:
- [env.production.backend](env.production.backend) - Environment variables
- [Procfile](Procfile) - Process definition
- [railway.json](railway.json) - Build config (alternative)
- [railway-commands.md](railway-commands.md) - CLI reference
- [seed-slides-manual.sql](seed-slides-manual.sql) - Database seeding

### Setting up Vercel:
- [env.production.frontend](env.production.frontend) - Environment variables
- [vercel.json](vercel.json) - Config (optional)
- [vercel-commands.md](vercel-commands.md) - CLI reference

### Planning & Budget:
- [COST-ESTIMATE.md](COST-ESTIMATE.md) - Monthly costs
- [BLOCKERS-AND-DECISIONS.md](BLOCKERS-AND-DECISIONS.md) - Decision points

### Troubleshooting:
- [00-DEPLOYMENT-CHECKLIST.md](00-DEPLOYMENT-CHECKLIST.md) - Has troubleshooting sections
- [railway-commands.md](railway-commands.md) - Database operations
- [vercel-commands.md](vercel-commands.md) - Deployment management

---

## ✅ Checklist Before Starting

- [ ] Read README.md
- [ ] Read BLOCKERS-AND-DECISIONS.md
- [ ] Create AWS account
- [ ] Create Railway account
- [ ] Create Vercel account
- [ ] Locate tiles on uni PC
- [ ] Verify manifest.json files exist
- [ ] Set aside 4-5 hours for deployment
- [ ] Have AWS CLI installed on uni PC
- [ ] Have Railway CLI installed locally (optional)
- [ ] Have password manager ready for saving credentials

---

## 🚨 Critical Reminders

1. **Generate NEW JWT_SECRET** - Don't use examples!
2. **Save all credentials** - Password manager recommended
3. **Set AWS billing alerts** - $30/month threshold
4. **Test each phase** - Don't skip ahead
5. **Backup database** - Before running migrations
6. **Update FRONTEND_URL** - After Vercel deployment
7. **Check CORS settings** - Common source of errors

---

## 📞 Getting Help

**Before deployment:**
- Read troubleshooting sections in checklist
- Check platform documentation
- Review error logs carefully

**During deployment:**
- Check Railway/Vercel deployment logs
- Review browser console for frontend errors
- Test each phase independently

**After deployment:**
- Monitor costs daily (first week)
- Check logs for errors
- Test with pilot users before full study

---

**Happy deploying! 🚀**
