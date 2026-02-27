# Monthly Cost Estimate

**Project:** Pathologist User Study Web App  
**Estimated Date:** February 2026  
**Study Duration:** Assumed 3-6 months active data collection

---

## 💰 Total Monthly Cost Summary

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| **Vercel** (Frontend) | **$0** | Free tier sufficient |
| **Railway** (Backend + PostgreSQL) | **$5** | Starter plan |
| **AWS S3** (Tile Storage) | **$5-10** | ~100GB storage |
| **AWS CloudFront** (CDN) | **$5-20** | Depends on usage |
| **Total** | **$15-35/month** | During active study |

---

## 📊 Detailed Breakdown

### 1. Vercel (Frontend Hosting) - **$0/month**

**Plan:** Free (Hobby)

**Includes:**
- Unlimited deployments
- 100 GB bandwidth/month
- Automatic HTTPS
- Global CDN
- Preview deployments

**Usage Estimate:**
- Average page size: ~500 KB
- Expected users: 10-20 pathologists
- Sessions per user: ~20-100 slides
- **Estimated bandwidth:** ~10-20 GB/month

**Cost:** ✅ **$0** (well within free tier)

**Risk of exceeding free tier:** ❌ Very low
- Would need 200+ GB bandwidth
- Equivalent to 400,000+ page loads
- Unlikely for small study

---

### 2. Railway (Backend + Database) - **$5/month**

**Plan:** Starter

**Includes:**
- 500 execution hours (always-on for 1 service)
- PostgreSQL database included
- 5 GB database storage
- 100 GB network egress
- GitHub auto-deployment

**Usage Estimate:**
- Backend API: Always-on (720 hours/month)
- Database: ~1 GB (events + sessions + slides)
- API calls: ~10,000-50,000 requests/month
- Network egress: ~5-10 GB/month

**Cost:** ✅ **$5/month** (Starter plan)

**Risk of exceeding plan:** ⚠️ Low-Medium
- Database growth: 1 GB = ~100,000 events (should be fine)
- Network egress: JSON responses are small, unlikely to hit 100 GB
- Execution hours: Covered for 1 always-on service

**If exceeded:**
- Upgrade to Developer plan: $20/month
- Unlikely unless study extends >6 months or 100+ users

---

### 3. AWS S3 (Tile Storage) - **$5-10/month**

**Pricing:**
- Storage: $0.023/GB/month (us-east-1, Standard tier)
- PUT requests: $0.005 per 1,000 requests
- GET requests: $0.0004 per 1,000 requests

**First 12 Months (Free Tier):**
- 5 GB storage FREE
- 20,000 GET requests FREE per month
- 2,000 PUT requests FREE per month

**Usage Estimate:**
- 20 slides × 5 GB average = **100 GB total storage**
- PUT requests: 20 slides × 5,000 tiles = 100,000 (one-time upload)
- GET requests: Minimal (CloudFront caches tiles)

**Cost Calculation:**

**Storage:**
```
100 GB × $0.023 = $2.30/month
```

**Upload (one-time):**
```
100,000 PUT requests = 100 × 1,000 = $0.50 (one-time)
```

**Monthly GET requests (after CloudFront caching):**
```
~10,000 GET requests = 10 × 1,000 × $0.0004 = $0.004/month (negligible)
```

**Total S3 cost:**
- **First 12 months:** $2.30/month (storage only, 5GB free = ~$2.18/month)
- **After free tier:** $2.30/month

**With overhead (API calls, versioning, etc.):** ~**$5-10/month**

---

### 4. AWS CloudFront (CDN) - **$5-20/month**

**Pricing (us-east-1 to North America):**
- Data transfer OUT: $0.085/GB (first 10 TB)
- HTTP/HTTPS requests: $0.0075 per 10,000 requests

**First 12 Months (Free Tier):**
- 1 TB (1,000 GB) data transfer OUT per month FREE
- 10,000,000 HTTP/HTTPS requests per month FREE

**Usage Estimate:**

**Initial load (first time each user views each slide):**
- 20 slides × 5 GB = 100 GB per user (worst case - all tiles loaded)
- Realistically: ~20-30 GB per user (only load viewed regions)
- 10 users × 30 GB = **300 GB initial cache misses**

**Subsequent loads (cached):**
- Cache hit rate: 70-90% (after initial loads)
- Remaining data transfer: ~10-30 GB/month

**Cost Calculation:**

**First month (cache building):**
```
300 GB × $0.085 = $25.50
- Free tier: -$85 (1 TB free) = $0
```

**Subsequent months (with caching):**
```
30 GB × $0.085 = $2.55/month
- Free tier (first 12 months): = $0
- After free tier: = $2.55/month
```

**HTTP requests:**
```
10,000,000 requests FREE (more than enough)
Estimated usage: ~500,000 requests/month (well under limit)
```

**Total CloudFront cost:**
- **First 12 months:** **$0** (within free tier)
- **After free tier:** **$5-15/month** (depends on usage)

**Optimization:**
- Use "North America + Europe" price class to save ~$5-10/month
- Cache tiles aggressively (24 hour TTL)
- Monitor cache hit rate (target >80%)

---

## 📈 Cost Timeline

### First 12 Months (AWS Free Tier Active)

| Month | Vercel | Railway | S3 | CloudFront | **Total** |
|-------|--------|---------|----|-----------|----|
| Month 1 | $0 | $5 | $5 | $0 | **$10** |
| Month 2-3 | $0 | $5 | $5 | $0 | **$10** |
| Month 4-6 | $0 | $5 | $5 | $0 | **$10** |
| Month 7-12 | $0 | $5 | $5 | $0 | **$10** |

**Average:** **$10/month** (first year with free tier)

### After 12 Months (No Free Tier)

| Month | Vercel | Railway | S3 | CloudFront | **Total** |
|-------|--------|---------|----|-----------|----|
| Month 13+ | $0 | $5 | $5 | $5-15 | **$15-25** |

**Average:** **$20/month** (after free tier expires)

---

## 🎯 Cost Optimization Tips

### Reduce S3 Costs

1. **Delete old slides after study completes**
   ```bash
   aws s3 rm s3://bucket/slides/ --recursive
   ```
   Savings: ~$2-5/month

2. **Use S3 Intelligent-Tiering**
   - Automatically moves infrequently accessed tiles to cheaper storage
   - Savings: ~$1-2/month for older slides

3. **Compress tiles more aggressively**
   - Use JPEG quality 80 instead of 90
   - Saves ~30-40% storage
   - Savings: ~$1-2/month

### Reduce CloudFront Costs

1. **Use "North America + Europe" price class**
   - Saves ~$5-10/month if users are only in those regions
   - Trade-off: Slower for other regions

2. **Increase cache TTL**
   - Default: 24 hours
   - Increase to 7 days (tiles don't change)
   - Reduces origin requests, improves cache hit rate

3. **Compress responses**
   - Enable Gzip/Brotli compression
   - Already enabled by default for most content

### Reduce Railway Costs

1. **Scale down during study breaks**
   - Pause services when not in active use
   - Resume when needed
   - Savings: $5/month during pauses

2. **Optimize database queries**
   - Add indexes (already done in migrations)
   - Reduces compute load slightly

3. **Archive old events**
   - Export to CSV monthly
   - Delete very old events if not needed
   - Keeps database size small

---

## 🚨 Cost Alerts & Monitoring

### AWS Billing Alert (CRITICAL - Set This Up!)

1. Go to AWS Billing Console → Budgets
2. Create budget:
   - **Name:** Pathology Study Budget
   - **Type:** Cost budget
   - **Amount:** $30/month
   - **Alerts:** 
     - 80% threshold ($24) → Email alert
     - 100% threshold ($30) → Email alert
     - 120% threshold ($36) → Email alert (overage)

### Railway Usage Monitoring

1. Railway Dashboard → Usage tab
2. Check weekly:
   - Execution hours (should be ~180/week for always-on)
   - Database size (should grow slowly)
   - Network egress (should be < 25 GB/week)

### Vercel Bandwidth Monitoring

1. Vercel Dashboard → Usage tab
2. Check monthly:
   - Bandwidth used (should be < 50 GB/month)
   - Build minutes (should be < 100/month)

---

## 💡 Scenarios & Estimates

### Scenario 1: Small Pilot Study (5 users, 10 slides, 1 month)

- **Vercel:** $0
- **Railway:** $5
- **S3:** $3 (50 GB storage)
- **CloudFront:** $0 (within free tier)
- **Total:** **$8/month**

### Scenario 2: Full Study (20 users, 20 slides, 6 months)

**During free tier (first 12 months):**
- **Vercel:** $0
- **Railway:** $5
- **S3:** $5
- **CloudFront:** $0 (within free tier)
- **Total:** **$10/month** × 6 months = **$60 total**

**After free tier:**
- **Vercel:** $0
- **Railway:** $5
- **S3:** $5
- **CloudFront:** $10
- **Total:** **$20/month** × 6 months = **$120 total**

### Scenario 3: Large Study (50 users, 50 slides, 12 months)

**During free tier:**
- **Vercel:** $0 (may hit limit → upgrade to Pro $20/month)
- **Railway:** $20 (need Developer plan for higher usage)
- **S3:** $15 (250 GB storage)
- **CloudFront:** $0 (within 1 TB free tier)
- **Total:** **$35-55/month**

**After free tier:**
- **Vercel:** $20
- **Railway:** $20
- **S3:** $15
- **CloudFront:** $30-40
- **Total:** **$85-95/month**

---

## 🎓 Academic Budget Justification

**For grant applications or budget proposals:**

### Year 1 (Setup + Active Study)

- **Setup:** $50 (one-time: domain, tools, testing)
- **Months 1-12:** $10-15/month × 12 = $120-180
- **Total Year 1:** **$170-230**

### Year 2 (Continued study or maintenance)

- **Months 13-24:** $20/month × 12 = $240
- **Total Year 2:** **$240**

### Total 2-Year Cost: **$410-470**

**Cost per participant:**
- 20 pathologists: **$20-25 per participant** (very affordable)
- 50 pathologists: **$8-10 per participant**

**Comparison to alternatives:**
- Commercial survey platforms: $50-100/month (limited features)
- Custom server hosting: $100-200/month (more expensive)
- On-premise infrastructure: $1,000+ setup + maintenance

**Value proposition:**
- Scalable, professional infrastructure
- Automatic backups and security
- Global CDN for fast loading
- Zero maintenance overhead

---

## ❓ Questions?

**"What if costs exceed budget?"**
- Pause Railway service ($5/month saved)
- Delete unused slides from S3 (~$1-2/month saved)
- Downgrade CloudFront price class (~$5-10/month saved)
- Export data and shut down temporarily

**"Can we reduce costs further?"**
- Yes, use free tier aggressively:
  - Render free tier (instead of Railway, but limited hours)
  - Cloudflare Pages (instead of Vercel, similar features)
  - Backblaze B2 (instead of S3, cheaper but slower)
- Trade-off: More complex setup, potential reliability issues

**"What happens after study completes?"**
- Export all data (CSV + database backup)
- Delete slides from S3 (~$5/month saved)
- Pause Railway service (~$5/month saved)
- Keep Vercel frontend for data viewing (still free)
- **Total archival cost:** $0/month (export data, shut down services)

---

**Summary:** Budget **$15-35/month** for active study period, with AWS free tier providing significant savings in first 12 months.
