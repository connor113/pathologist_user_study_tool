# Deployment Preparation Materials

**Generated:** 2026-02-16  
**Purpose:** Infrastructure setup for Pathologist User Study Web App  
**Stack:** Vercel (frontend) + Railway (backend/PostgreSQL) + AWS S3+CloudFront (tiles)

---

## 📁 What's in This Directory?

All the configuration files, scripts, and documentation you need to deploy the web app to production **without modifying any existing code**.

### 🗺️ Start Here

1. **[00-DEPLOYMENT-CHECKLIST.md](00-DEPLOYMENT-CHECKLIST.md)** - Step-by-step deployment guide (READ THIS FIRST)
2. **[BLOCKERS-AND-DECISIONS.md](BLOCKERS-AND-DECISIONS.md)** - What needs to be decided/resolved before deploying
3. **[QUICK-START-GUIDE.md](QUICK-START-GUIDE.md)** - TL;DR version for experienced developers

---

## 📄 Configuration Files

### AWS S3 + CloudFront

- **`s3-bucket-policy.json`** - S3 bucket policy for public tile access
- **`s3-bucket-policy-cloudfront.json`** - S3 policy for CloudFront origin access control
- **`cloudfront-config-notes.md`** - Detailed CloudFront setup guide

### Railway (Backend)

- **`Procfile`** - Railway process definition (copy to repo root)
- **`railway.json`** - Railway build configuration (optional, Procfile preferred)
- **`env.production.backend`** - Backend environment variables template

### Vercel (Frontend)

- **`vercel.json`** - Vercel deployment configuration (optional, auto-detected)
- **`env.production.frontend`** - Frontend environment variables template

---

## 🔧 Scripts & Tools

### Tile Upload (Run on Uni PC)

- **`upload-tiles-to-s3.sh`** - Bash script for AWS CLI tile upload (Linux/Mac/WSL)
- **`upload-tiles-to-s3.ps1`** - PowerShell script for AWS CLI tile upload (Windows)
- **`aws-cli-install.sh`** - AWS CLI installation helper

### Database Setup

- **`seed-slides-manual.sql`** - SQL template for inserting slide metadata
- **`bcrypt-hash-generator.js`** - Generate password hashes for users (if needed)
- **`generate-jwt-secret.sh`** - Generate secure JWT secret

---

## 📚 Reference Documentation

- **`railway-commands.md`** - Railway CLI command reference
- **`vercel-commands.md`** - Vercel CLI command reference
- **`COST-ESTIMATE.md`** - Detailed monthly cost breakdown

---

## 🚀 Quick Start (Experienced Developers)

```bash
# 1. Create accounts
# - AWS: aws.amazon.com
# - Railway: railway.app (link GitHub)
# - Vercel: vercel.com (link GitHub)

# 2. AWS: Create S3 bucket + CloudFront
# - Bucket: pathology-study-tiles-<your-name>
# - Policy: Use s3-bucket-policy.json (update bucket name)
# - CloudFront: Point to S3, enable OAC
# - Save: CLOUDFRONT_URL

# 3. Upload tiles from uni PC
aws s3 sync /path/to/tiles s3://YOUR-BUCKET/slides/ --exclude "*.dzi"

# 4. Railway: Deploy backend
# - New project from GitHub
# - Add PostgreSQL database
# - Set env vars from env.production.backend
# - Run migrations via Railway CLI
# - Save: BACKEND_URL

# 5. Vercel: Deploy frontend
# - Import GitHub repo
# - Set VITE_API_URL=BACKEND_URL
# - Deploy
# - Save: FRONTEND_URL

# 6. Update Railway FRONTEND_URL to Vercel URL, redeploy

# 7. Seed database
railway run npx ts-node scripts/create-test-users.ts
railway run npx ts-node scripts/seed-slides.ts  # Or use SQL template

# 8. Test
# - Visit FRONTEND_URL
# - Login: admin / admin123
# - Verify tiles load from CloudFront
```

**Time:** ~3-4 hours (including tile upload)

---

## 📊 File Usage Matrix

| File | When to Use | Platform |
|------|-------------|----------|
| `00-DEPLOYMENT-CHECKLIST.md` | First-time deployment | All |
| `BLOCKERS-AND-DECISIONS.md` | Before starting | Planning |
| `s3-bucket-policy.json` | AWS S3 setup | AWS Console |
| `cloudfront-config-notes.md` | AWS CloudFront setup | AWS Console |
| `upload-tiles-to-s3.sh` | Tile upload (Linux/Mac) | Uni PC |
| `upload-tiles-to-s3.ps1` | Tile upload (Windows) | Uni PC |
| `Procfile` | Railway deployment | Copy to repo root |
| `env.production.backend` | Railway env vars | Railway dashboard |
| `env.production.frontend` | Vercel env vars | Vercel dashboard |
| `seed-slides-manual.sql` | Database seeding | Railway query editor |
| `railway-commands.md` | Railway CLI help | Reference |
| `vercel-commands.md` | Vercel CLI help | Reference |

---

## ⚠️ Important Notes

### DO NOT:
- ❌ Commit these files to git (contains sensitive info placeholders)
- ❌ Modify existing project code files
- ❌ Push Procfile without testing locally first

### DO:
- ✅ Replace all `YOUR-BUCKET-NAME`, `YOUR-CLOUDFRONT-URL` placeholders
- ✅ Generate new JWT_SECRET (don't use examples)
- ✅ Save all URLs and credentials securely (password manager)
- ✅ Test each phase before moving to next
- ✅ Backup database before running migrations

---

## 🆘 Troubleshooting

### Common Issues

**Tiles not loading (403 errors):**
- Check S3 bucket policy allows public read
- Verify CloudFront OAC is configured
- Update S3 policy with CloudFront ARN

**CORS errors in browser:**
- Update Railway `FRONTEND_URL` to match Vercel URL
- Redeploy Railway backend

**Database connection fails:**
- Verify `DATABASE_URL` is set (Railway auto-provides this)
- Check PostgreSQL service is running in Railway

**Build fails on Railway:**
- Check build logs in Railway dashboard
- Verify `Procfile` or `railway.json` has correct paths
- Test build locally: `cd backend && npm run build`

**Build fails on Vercel:**
- Check build logs in Vercel dashboard
- Verify `VITE_API_URL` is set
- Test build locally: `npm run build`

### Getting Help

1. Check deployment checklist troubleshooting section
2. Check Railway/Vercel documentation
3. Review platform-specific logs
4. Search error message on Stack Overflow
5. Ask in Railway/Vercel Discord (links in platform docs)

---

## 📈 After Deployment

### Monitoring

**Daily (first week):**
- Check Railway logs for errors
- Monitor AWS costs (Billing dashboard)
- Test login and slide loading

**Weekly:**
- Review user activity (events count)
- Check database size
- Verify backups

**Monthly:**
- Review costs vs budget
- Analyze usage patterns
- Optimize if needed

### Maintenance

**Database backups:**
```bash
# Weekly backup
railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

**Cost monitoring:**
- AWS: Set billing alert at $30/month
- Railway: Check usage tab
- Vercel: Check bandwidth usage

**Security:**
- Rotate JWT_SECRET if compromised
- Keep dependencies updated
- Review access logs monthly

---

## 🎯 Success Criteria

Deployment is successful when:

- [ ] Backend health check returns 200 OK
- [ ] Frontend loads without errors
- [ ] Admin can login and access dashboard
- [ ] Pathologists can login and view slides
- [ ] Tiles load from CloudFront (<500ms)
- [ ] Pan/zoom works smoothly
- [ ] Events save to database
- [ ] Sessions complete with diagnosis labels
- [ ] CSV export works (admin)
- [ ] No CORS errors in browser console
- [ ] No 4xx/5xx errors in Railway logs
- [ ] AWS costs < $50/month
- [ ] Railway costs < $10/month
- [ ] Vercel costs = $0 (free tier)

---

## 📞 Contact

If you find issues with these deployment materials:

1. Check the troubleshooting sections
2. Review the full DEPLOYMENT.md in repo root
3. File an issue on GitHub (if repo is public)
4. Contact project maintainer

---

## 📝 Changelog

**2026-02-16:** Initial deployment prep materials generated
- Created comprehensive checklist
- Generated all config files
- Added scripts for automation
- Documented blockers and decisions

---

## 📖 Additional Resources

- [Railway Docs](https://docs.railway.app)
- [Vercel Docs](https://vercel.com/docs)
- [AWS S3 Docs](https://docs.aws.amazon.com/s3)
- [AWS CloudFront Docs](https://docs.aws.amazon.com/cloudfront)
- [Vite Deployment](https://vitejs.dev/guide/static-deploy.html)
- [Express.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
