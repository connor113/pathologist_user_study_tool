# Railway CLI Commands Reference

Quick reference for Railway deployment and management.

---

## Installation

```bash
# Install Railway CLI globally
npm install -g @railway/cli

# Verify installation
railway --version
```

---

## Authentication

```bash
# Login to Railway (opens browser)
railway login

# Logout
railway logout

# Check current user
railway whoami
```

---

## Project Management

```bash
# Link local directory to Railway project
railway link
# Then select project from list

# Unlink project
railway unlink

# Show current project info
railway status

# List all projects
railway list
```

---

## Deployment

```bash
# Deploy current directory to Railway
railway up

# Deploy with environment selection
railway up --environment production

# Watch logs during deployment
railway logs --follow
```

---

## Environment Variables

```bash
# List all environment variables
railway variables

# Set environment variable
railway variables set KEY=value

# Set multiple variables
railway variables set KEY1=value1 KEY2=value2

# Delete variable
railway variables delete KEY

# Load variables from .env file
railway variables set < .env
```

---

## Database Operations

### Run SQL Migration

```bash
# Run migration file
railway run psql $DATABASE_URL -f backend/src/db/migrations/001_initial.sql

# Run SQL command directly
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### Database Backup

```bash
# Backup database to file
railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
railway run psql $DATABASE_URL < backup-20260216.sql
```

### Database Shell

```bash
# Open PostgreSQL shell
railway run psql $DATABASE_URL

# Run query and exit
railway run psql $DATABASE_URL -c "SELECT * FROM slides;"
```

---

## Running Scripts

### Run Node.js Scripts

```bash
# Run TypeScript script with ts-node
railway run npx ts-node scripts/create-test-users.ts

# Run compiled JavaScript
railway run node dist/scripts/seed-data.js
```

### Run with Specific Environment

```bash
# Run in production environment
railway run --environment production npx ts-node scripts/seed-slides.ts

# Run in staging environment
railway run --environment staging npm test
```

---

## Logs and Debugging

```bash
# View recent logs
railway logs

# Follow logs in real-time
railway logs --follow

# Filter logs by deployment
railway logs --deployment <deployment-id>

# View logs for specific service
railway logs --service backend
```

---

## Service Management

```bash
# List all services in project
railway service list

# Restart service
railway service restart <service-name>

# Delete service
railway service delete <service-name>
```

---

## Domains

```bash
# List domains
railway domain

# Add custom domain
railway domain add example.com

# Remove domain
railway domain remove example.com
```

---

## Useful Combinations

### Full Deployment Flow

```bash
# 1. Link project
railway link

# 2. Set environment variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secret-here

# 3. Deploy
railway up

# 4. Run migrations
railway run psql $DATABASE_URL -f backend/src/db/migrations/001_initial.sql

# 5. Seed data
railway run npx ts-node scripts/create-test-users.ts

# 6. Watch logs
railway logs --follow
```

### Check Deployment Health

```bash
# 1. Check status
railway status

# 2. View recent logs
railway logs --tail 50

# 3. Test database connection
railway run psql $DATABASE_URL -c "SELECT 1;"

# 4. Check environment variables
railway variables | grep DATABASE_URL
```

### Quick Database Query

```bash
# Check users
railway run psql $DATABASE_URL -c "SELECT username, role FROM users;"

# Check slides
railway run psql $DATABASE_URL -c "SELECT slide_id, s3_key_prefix FROM slides;"

# Check sessions count
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM sessions;"

# Check events count
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM events;"
```

---

## Troubleshooting

### Build Fails

```bash
# View build logs
railway logs --deployment <deployment-id>

# Check build command
railway variables | grep BUILD_COMMAND

# Test build locally
cd backend && npm run build
```

### Database Connection Issues

```bash
# Verify DATABASE_URL is set
railway variables | grep DATABASE_URL

# Test connection
railway run psql $DATABASE_URL -c "SELECT version();"

# Check PostgreSQL service status
railway service list
```

### Environment Variable Not Applied

```bash
# List current variables
railway variables

# Redeploy after setting variable
railway up

# Or use Railway dashboard to trigger redeploy
```

---

## Advanced: Multiple Environments

```bash
# Create new environment
railway environment create staging

# Switch environment
railway environment select staging

# List environments
railway environment list

# Deploy to specific environment
railway up --environment production
```

---

## Railway.json Configuration

Create `railway.json` in project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd backend && npm install && npm run build"
  },
  "deploy": {
    "startCommand": "cd backend && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

---

## Tips & Best Practices

1. **Use Procfile** for simple deployments:
   ```
   web: cd backend && npm start
   ```

2. **Test locally first**:
   ```bash
   cd backend && npm run build && npm start
   ```

3. **Backup before migrations**:
   ```bash
   railway run pg_dump $DATABASE_URL > backup-before-migration.sql
   ```

4. **Use environment-specific variables**:
   ```bash
   railway variables set --environment production JWT_SECRET=prod-secret
   railway variables set --environment staging JWT_SECRET=staging-secret
   ```

5. **Monitor costs**:
   - Check Railway dashboard → Usage tab
   - Set up billing alerts

---

## Emergency Rollback

```bash
# 1. View deployment history
railway deployments

# 2. Rollback to previous deployment
railway deployment rollback <deployment-id>

# 3. Restore database from backup (if needed)
railway run psql $DATABASE_URL < backup.sql
```

---

## Documentation

- Railway Docs: https://docs.railway.app
- CLI Reference: https://docs.railway.app/develop/cli
- Railway Discord: https://discord.gg/railway
