# CloudFront Distribution Configuration

**Purpose:** Serve slide tiles from S3 with global CDN caching for fast load times.

---

## Configuration Settings

### Origin Settings

| Setting | Value | Notes |
|---------|-------|-------|
| **Origin Domain** | `pathology-study-tiles-<your-name>.s3.us-east-1.amazonaws.com` | Your S3 bucket |
| **Origin Path** | `/slides` | Optional: All tiles are under `/slides` prefix |
| **Origin Access** | Origin Access Control (OAC) | **Recommended** - More secure than OAI |
| **OAC Name** | `pathology-study-oac` | Create new OAC |
| **Signing Behavior** | Sign requests (recommended) | CloudFront signs requests to S3 |

### Cache Behavior Settings

| Setting | Value | Notes |
|---------|-------|-------|
| **Path Pattern** | `Default (*)` | All requests |
| **Viewer Protocol Policy** | **HTTPS only** | Force HTTPS for security |
| **Allowed HTTP Methods** | GET, HEAD, OPTIONS | Read-only access |
| **Cache Policy** | `CachingOptimized` | Managed policy (1 day TTL) |
| **Origin Request Policy** | None | Not needed for static content |
| **Response Headers Policy** | None (optional: CORS policy) | Add CORS if accessing from other domains |

### Cache Key and TTL

**Using CachingOptimized policy:**
- Minimum TTL: 1 second
- Maximum TTL: 31536000 seconds (1 year)
- Default TTL: 86400 seconds (1 day)

**Custom TTL (if creating custom cache policy):**
- Minimum: 0 seconds (cache disabled for development)
- Default: 86400 seconds (1 day - good for study)
- Maximum: 604800 seconds (7 days - tiles rarely change)

### Distribution Settings

| Setting | Value | Notes |
|---------|-------|-------|
| **Price Class** | Use all edge locations | Best performance (or "North America + Europe" to save $) |
| **Alternate Domain Names (CNAMEs)** | None | Use CloudFront domain (or add custom domain later) |
| **SSL Certificate** | Default CloudFront certificate | Free HTTPS |
| **Supported HTTP Versions** | HTTP/2, HTTP/3 | Faster for many tiles |
| **Default Root Object** | None | No index.html needed |
| **Standard Logging** | Off | Enable for debugging (costs extra) |
| **IPv6** | Enabled | Better connectivity |

---

## After Creating Distribution

### 1. Copy Distribution Domain Name

Example: `d1234abcd5678.cloudfront.net`

**Save this for:**
- Backend environment variable: `CLOUDFRONT_URL`
- Testing tile URLs

### 2. Update S3 Bucket Policy

After distribution is created:

1. Go to CloudFront distribution → **Origins** tab
2. Click your origin → **Edit**
3. Scroll to **Origin access control**
4. Click **Copy policy** button
5. Go to S3 bucket → **Permissions** → **Bucket Policy**
6. **Replace** the existing policy with the copied CloudFront policy
7. Save changes

The policy will look like `s3-bucket-policy-cloudfront.json` with your specific distribution ARN.

### 3. Test CloudFront

**Test URL format:**
```
https://YOUR-CLOUDFRONT-DOMAIN/slides/SLIDE_ID/files/LEVEL/X_Y.jpeg
```

**Example:**
```
https://d1234abcd5678.cloudfront.net/slides/slide_001/files/14/0_0.jpeg
```

**Expected:**
- Status: 200 OK
- Content-Type: image/jpeg
- Image displays in browser
- First request: X-Cache: Miss from cloudfront
- Second request: X-Cache: Hit from cloudfront

**Troubleshooting:**
- 403 Forbidden: S3 bucket policy not updated with CloudFront OAC
- 404 Not Found: Tile doesn't exist in S3, check path
- Slow first load: Normal - CloudFront needs to cache from S3 first time

---

## Cost Optimization

### Cache Hit Rate

Monitor in CloudFront Console → Distribution → Monitoring:

- **Target:** >90% cache hit rate after initial loads
- **First load:** All tiles are cache misses (slow)
- **Subsequent loads:** Most tiles cached (fast)

### Price Class Options

| Price Class | Regions | Cost | Best For |
|-------------|---------|------|----------|
| **All edge locations** | All regions worldwide | Highest | Global users |
| **North America + Europe** | US, Canada, Europe | Medium | US/EU users only |
| **North America only** | US, Canada, Mexico | Lowest | US users only |

**Recommendation for study:** Start with "All edge locations" (best performance). If costs are too high and all pathologists are in one region, downgrade.

### Data Transfer Costs

**AWS Free Tier (first 12 months):**
- CloudFront: 1 TB data transfer OUT per month (FREE)
- After free tier: $0.085/GB (varies by region)

**Estimate for 20 slides:**
- Average slide: 5 GB
- 20 slides × 5 GB = 100 GB total
- 10 pathologists × 100 GB = 1 TB total transfer
- **Cost after free tier:** ~$85/month (if all tiles loaded by everyone)
- **Realistic with caching:** ~$20-40/month (cache hit rate 70-90%)

---

## Monitoring & Metrics

### Key Metrics to Watch

In CloudFront Console → Distribution → Monitoring:

1. **Requests:** Total tile requests per day
2. **Data Transferred:** GB transferred per day
3. **Cache Hit Rate:** Percentage of cached responses
4. **Error Rate:** 4xx and 5xx errors

### Alerts to Set Up (Optional)

Using CloudWatch Alarms:

- **High Error Rate:** Alert if 4xx/5xx > 5%
- **High Data Transfer:** Alert if daily transfer > 50 GB
- **Low Cache Hit Rate:** Alert if < 70% (indicates caching issue)

---

## Security Considerations

### Current Setup (Public Tiles)

- Tiles are publicly readable via CloudFront
- Anyone with the URL can view tiles
- Acceptable for: Anonymized research slides

### If You Need Secure Access (Future)

Options:
1. **Signed URLs:** Generate time-limited URLs from backend
2. **Signed Cookies:** Set cookies for session-based access
3. **AWS WAF:** Add firewall rules to restrict access by IP/region
4. **Private S3 + Lambda@Edge:** Full authentication at edge

**Trade-off:** Security vs complexity/cost. For this study, public tiles are acceptable if slides are anonymized.

---

## Invalidation (Cache Clearing)

If you need to update tiles and clear cache:

```bash
# Install AWS CLI
aws cloudfront create-invalidation \
  --distribution-id YOUR-DISTRIBUTION-ID \
  --paths "/slides/*"
```

**Cost:** First 1000 invalidation paths per month are free, then $0.005 per path.

**When to use:**
- Updated a tile and need immediate refresh
- Fixed a broken tile
- Changed S3 directory structure

**Avoid:** Frequent invalidations (use versioned paths instead: `slides/v2/slide_001/...`)

---

## Migration Notes

If you later want to change S3 bucket or region:

1. Create new S3 bucket in desired region
2. Copy data: `aws s3 sync s3://old-bucket s3://new-bucket`
3. Create new CloudFront distribution pointing to new bucket
4. Update backend `CLOUDFRONT_URL` environment variable
5. Test new distribution
6. Delete old distribution after confirming all works

---

## Documentation Links

- [CloudFront Developer Guide](https://docs.aws.amazon.com/cloudfront/)
- [Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Cache Policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html)
- [Pricing](https://aws.amazon.com/cloudfront/pricing/)
