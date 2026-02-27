# Vercel CLI Commands Reference

Quick reference for Vercel frontend deployment.

---

## Installation

```bash
# Install Vercel CLI globally
npm install -g vercel

# Verify installation
vercel --version
```

---

## Authentication

```bash
# Login to Vercel
vercel login

# Logout
vercel logout

# Check current user
vercel whoami
```

---

## Deployment

### Initial Deployment

```bash
# From project root
vercel

# Follow prompts:
# - Link to existing project? No (for first time)
# - Project name: pathology-study
# - Framework: Vite
# - Root directory: ./
# - Build command: npm run build
# - Output directory: dist
```

### Subsequent Deployments

```bash
# Deploy to preview (staging)
vercel

# Deploy to production
vercel --prod

# Deploy with environment selection
vercel --prod --env production
```

---

## Project Linking

```bash
# Link local directory to Vercel project
vercel link

# Unlink project
vercel unlink
```

---

## Environment Variables

```bash
# List environment variables
vercel env ls

# Add environment variable
vercel env add VITE_API_URL

# Add variable for specific environment
vercel env add VITE_API_URL production

# Pull environment variables to local .env
vercel env pull .env.local

# Remove environment variable
vercel env rm VITE_API_URL
```

---

## Project Management

```bash
# List projects
vercel projects ls

# Get project info
vercel inspect

# Remove project
vercel projects rm <project-name>
```

---

## Domains

```bash
# List domains
vercel domains ls

# Add domain
vercel domains add example.com

# Remove domain
vercel domains rm example.com

# Verify domain
vercel domains verify example.com
```

---

## Logs

```bash
# View deployment logs (not runtime logs - Vercel is static)
vercel logs <deployment-url>

# View latest deployment logs
vercel logs
```

---

## Useful Commands

### Check Build Locally

```bash
# Build locally to test
npm run build

# Preview build locally
npm run preview
```

### Deployment Info

```bash
# Get deployment URL
vercel --prod

# List all deployments
vercel deployments ls

# View specific deployment
vercel inspect <deployment-url>
```

---

## Configuration File: vercel.json

Create `vercel.json` in project root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

---

## Common Workflows

### Full Deployment

```bash
# 1. Test build locally
npm run build

# 2. Deploy to preview (test)
vercel

# 3. Test preview deployment
# Visit the preview URL provided

# 4. Deploy to production
vercel --prod

# 5. Verify production
# Visit your production URL
```

### Update Environment Variable

```bash
# 1. Add/update variable via dashboard (easier)
# Or via CLI:
vercel env add VITE_API_URL production

# 2. Trigger redeploy to apply changes
vercel --prod
```

### Rollback Deployment

```bash
# 1. List deployments
vercel deployments ls

# 2. Promote previous deployment to production
vercel alias set <previous-deployment-url> <production-domain>

# Or via dashboard:
# Deployments → Previous deployment → Promote to Production
```

---

## Troubleshooting

### Build Fails

```bash
# 1. Check build logs in Vercel dashboard
# Deployments → Click deployment → View build logs

# 2. Test build locally
npm run build

# 3. Check vite.config.ts is correct

# 4. Verify package.json scripts:
npm run build  # Should succeed locally
```

### Environment Variable Not Applied

```bash
# 1. Verify variable is set
vercel env ls

# 2. Check variable is for correct environment
# (Production / Preview / Development)

# 3. Redeploy after adding variable
vercel --prod

# 4. Verify in browser console
# Should see API calls going to correct URL
```

### CORS Errors

This is a backend issue, not Vercel:

```bash
# 1. Check Railway FRONTEND_URL matches Vercel URL
railway variables | grep FRONTEND_URL

# 2. Update if incorrect
railway variables set FRONTEND_URL=https://your-app.vercel.app

# 3. Redeploy backend
railway up
```

---

## Tips & Best Practices

1. **Use Preview Deployments**:
   - Every `vercel` command creates a preview
   - Test before promoting to production
   - Share preview URLs with team for testing

2. **Environment Variables**:
   - Set for all environments (Production, Preview, Development)
   - Use `VITE_` prefix for variables accessible in frontend
   - Never put secrets in frontend (they're visible to browser)

3. **Monitor Bandwidth**:
   - Check Vercel dashboard → Usage
   - Free tier: 100 GB/month
   - Should be sufficient for 5-10 users

4. **Custom Domains**:
   - Add custom domain in Vercel dashboard
   - Configure DNS (Vercel provides instructions)
   - SSL is automatic and free

5. **Git Integration**:
   - Link Vercel to GitHub repository
   - Auto-deploy on push to main branch
   - Preview deployments for pull requests

---

## Vercel Dashboard (Easier for Most Tasks)

Many tasks are easier via dashboard:

1. **Environment Variables**: Settings → Environment Variables
2. **Deployments**: Deployments tab → View/promote/redeploy
3. **Domains**: Settings → Domains
4. **Build Logs**: Deployments → Click deployment → Logs
5. **Usage**: Project → Usage tab

CLI is best for:
- CI/CD pipelines
- Automated deployments
- Scripting

---

## Documentation

- Vercel Docs: https://vercel.com/docs
- CLI Reference: https://vercel.com/docs/cli
- Vite on Vercel: https://vercel.com/docs/frameworks/vite
