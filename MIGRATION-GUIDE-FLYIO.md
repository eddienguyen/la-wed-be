# Migration Guide: Supabase/Render.com → Fly.io

**Version:** 1.0  
**Date:** 2025-10-17  
**Author:** GitHub Copilot Agent  

This comprehensive guide provides step-by-step instructions for migrating the Wedding Guest Management backend from Supabase + Render.com to Fly.io (both database and application).

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Migration Overview](#migration-overview)
3. [Part 1: Setup Fly.io PostgreSQL Database](#part-1-setup-flyio-postgresql-database)
4. [Part 2: Migrate Database Data](#part-2-migrate-database-data)
5. [Part 3: Deploy Application to Fly.io](#part-3-deploy-application-to-flyio)
6. [Part 4: Verify Migration](#part-4-verify-migration)
7. [Part 5: Update Frontend Configuration](#part-5-update-frontend-configuration)
8. [Part 6: Cleanup Old Infrastructure](#part-6-cleanup-old-infrastructure)
9. [Rollback Plan](#rollback-plan)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting the migration, ensure you have:

### Required Tools
- ✅ **flyctl CLI** installed (https://fly.io/docs/hands-on/install-flyctl/)
- ✅ **Node.js 18+** installed
- ✅ **npm** installed
- ✅ **PostgreSQL client** (`psql`) installed
- ✅ **git** installed

### Required Access
- ✅ Fly.io account (create at https://fly.io/app/sign-up)
- ✅ Access to current Supabase database (connection strings)
- ✅ GitHub repository access (`eddienguyen/la-wed-be`)
- ✅ Credit card for Fly.io (required even for free tier)

### Installation Commands

```bash
# Install flyctl (macOS)
brew install flyctl

# Install flyctl (Linux)
curl -L https://fly.io/install.sh | sh

# Install flyctl (Windows)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Verify installation
flyctl version

# Install PostgreSQL client (macOS)
brew install postgresql@15

# Install PostgreSQL client (Ubuntu/Debian)
sudo apt-get install postgresql-client-15

# Install PostgreSQL client (Windows)
# Download from: https://www.postgresql.org/download/windows/
```

---

## Migration Overview

### Timeline
- **Estimated Duration:** 30-60 minutes
- **Downtime:** 5-10 minutes (during database cutover)

### Architecture Changes

**Before (Supabase + Render.com):**
```
Frontend → Render.com API → Supabase PostgreSQL
   |                              ↓
   └──────────────────→ Cloudflare R2 (images)
```

**After (Fly.io):**
```
Frontend → Fly.io API → Fly.io PostgreSQL
   |                          ↓
   └──────────────────→ Cloudflare R2 (images)
```

### Key Improvements
- ✅ **No cold starts** - Always-on machines
- ✅ **Better reliability** - No instance failures
- ✅ **Integrated database** - Fly.io Postgres with automatic backups
- ✅ **Better monitoring** - Built-in metrics and logs
- ✅ **Geographic distribution** - Can deploy to multiple regions

---

## Part 1: Setup Fly.io PostgreSQL Database

### Step 1.1: Login to Fly.io

```bash
# Login to Fly.io
flyctl auth login

# Verify login
flyctl auth whoami
```

### Step 1.2: Create Fly.io PostgreSQL Database

```bash
# Create PostgreSQL app
# This creates a PostgreSQL cluster in Singapore region
flyctl postgres create \
  --name la-wed-database \
  --region sin \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1

# Note: Save the generated credentials shown in the output!
# You'll need:
# - Username: postgres
# - Password: [generated password]
# - Hostname: la-wed-database.internal
# - Port: 5432
# - Database: la_wed_database
```

**Expected Output:**
```
Creating postgres cluster la-wed-database in organization personal
Creating app...
Setting secrets on app la-wed-database...
Provisioning 1 of 1 machines with image flyio/postgres:15
...

Postgres cluster la-wed-database created
  Username:    postgres
  Password:    [SAVE THIS PASSWORD]
  Hostname:    la-wed-database.internal
  Proxy Port:  5432
  PG Port:     5433
  Connection string: postgres://postgres:[PASSWORD]@la-wed-database.internal:5432/la_wed_database?sslmode=disable
```

### Step 1.3: Save Database Credentials

Create a secure note with these credentials:

```env
# Fly.io PostgreSQL Credentials
DATABASE_URL=postgres://postgres:[PASSWORD]@la-wed-database.internal:5432/la_wed_database?sslmode=disable
DIRECT_URL=postgres://postgres:[PASSWORD]@la-wed-database.internal:5432/la_wed_database?sslmode=disable
```

**Note:** Fly.io PostgreSQL doesn't need separate transaction/session mode URLs like Supabase. Use the same URL for both.

### Step 1.4: Verify Database Connection

```bash
# Connect to the database
flyctl postgres connect -a la-wed-database

# Once connected, verify the database
\l
\q
```

---

## Part 2: Migrate Database Data

### Step 2.1: Export Data from Supabase

```bash
# Set your Supabase connection string
export SUPABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Export schema and data
pg_dump "$SUPABASE_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  -f /tmp/supabase_backup.sql

# Verify backup file
ls -lh /tmp/supabase_backup.sql
```

### Step 2.2: Import Data to Fly.io

```bash
# Create a proxy to access Fly.io database locally
flyctl proxy 15432:5432 -a la-wed-database &

# Wait a few seconds for proxy to start
sleep 5

# Import the data
psql "postgres://postgres:[PASSWORD]@localhost:15432/la_wed_database?sslmode=disable" \
  -f /tmp/supabase_backup.sql

# Stop the proxy
kill %1
```

### Step 2.3: Verify Data Migration

```bash
# Connect to Fly.io database
flyctl postgres connect -a la-wed-database

# Verify tables exist
\dt

# Check guest count
SELECT COUNT(*) FROM guests;

# Sample some data
SELECT id, name, venue FROM guests LIMIT 5;

# Exit
\q
```

---

## Part 3: Deploy Application to Fly.io

### Step 3.1: Prepare Application

```bash
# Clone/navigate to repository
cd /path/to/la-wed-be

# Ensure dependencies are up to date
npm install

# Generate Prisma client
npm run prisma:generate
```

### Step 3.2: Initialize Fly.io App

```bash
# Launch Fly.io app (interactive setup)
flyctl launch

# Answer the prompts:
# - App name: la-wed-backend
# - Region: Singapore (sin)
# - Add Postgres database? No (we already created it)
# - Deploy now? No (we need to set secrets first)
```

**Note:** This creates a `fly.toml` file. A pre-configured version is already in the repository, so you may skip this if the file exists.

### Step 3.3: Attach Database to Application

```bash
# Attach the PostgreSQL database to the app
flyctl postgres attach la-wed-database --app la-wed-backend

# This automatically sets the DATABASE_URL secret
```

### Step 3.4: Set Environment Secrets

```bash
# Set required secrets
flyctl secrets set \
  DIRECT_URL="postgres://postgres:[PASSWORD]@la-wed-database.internal:5432/la_wed_database?sslmode=disable" \
  CORS_ORIGIN="https://ngocquanwd.com" \
  FRONTEND_URL="https://ngocquanwd.com" \
  --app la-wed-backend

# Set optional secrets (if using Cloudflare R2 for images)
flyctl secrets set \
  R2_ENDPOINT="https://[ACCOUNT_ID].r2.cloudflarestorage.com" \
  R2_ACCESS_KEY_ID="[YOUR_ACCESS_KEY]" \
  R2_SECRET_ACCESS_KEY="[YOUR_SECRET_KEY]" \
  R2_BUCKET_NAME="[YOUR_BUCKET_NAME]" \
  R2_PUBLIC_URL="https://images.ngocquanwd.com" \
  --app la-wed-backend

# Verify secrets are set
flyctl secrets list --app la-wed-backend
```

### Step 3.5: Update Prisma Schema (if needed)

The Prisma schema should already be configured, but verify:

```javascript
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Note:** No changes needed! Fly.io PostgreSQL works with the same schema.

### Step 3.6: Deploy Application

```bash
# Deploy to Fly.io
flyctl deploy --app la-wed-backend

# Monitor deployment
flyctl logs --app la-wed-backend
```

**Expected Output:**
```
==> Building image
...
==> Pushing image to fly
...
==> Deploying
...
--> v0 deployed successfully
```

### Step 3.7: Run Database Migrations

```bash
# Open a console on Fly.io
flyctl ssh console --app la-wed-backend

# Once connected, run migrations
cd /usr/src/app
npm run prisma:migrate:deploy

# Exit
exit
```

---

## Part 4: Verify Migration

### Step 4.1: Test Health Endpoint

```bash
# Get app URL
flyctl info --app la-wed-backend

# Test health endpoint
curl https://la-wed-backend.fly.dev/api/health

# Expected response
{
  "success": true,
  "data": {
    "message": "Server is healthy",
    "server": {
      "status": "running",
      "uptime": 123.456,
      "timestamp": "2025-10-17T10:30:00Z",
      "nodeVersion": "v20.19.0",
      "environment": "production"
    },
    "database": {
      "status": "connected",
      "latency": "5ms",
      "timestamp": "2025-10-17T10:30:00Z"
    }
  }
}
```

### Step 4.2: Test Database Endpoint

```bash
# Test database health
curl https://la-wed-backend.fly.dev/api/health/database
```

### Step 4.3: Test Guest API

```bash
# List guests
curl https://la-wed-backend.fly.dev/api/guests

# Get specific guest (replace with actual ID)
curl https://la-wed-backend.fly.dev/api/guests/[GUEST_ID]
```

### Step 4.4: Monitor Application

```bash
# View real-time logs
flyctl logs --app la-wed-backend

# View metrics
flyctl dashboard --app la-wed-backend

# Check machine status
flyctl status --app la-wed-backend
```

---

## Part 5: Update Frontend Configuration

### Step 5.1: Update Frontend API URL

Update your frontend environment variables:

```env
# Old URL (Render.com)
VITE_API_URL=https://la-wed-backend.onrender.com

# New URL (Fly.io)
VITE_API_URL=https://la-wed-backend.fly.dev
```

### Step 5.2: Test Frontend Integration

1. Update frontend `.env` file
2. Rebuild frontend: `npm run build`
3. Deploy frontend
4. Test all API calls from frontend

### Step 5.3: Custom Domain (Optional)

If you want to use a custom domain for the API:

```bash
# Add custom domain
flyctl certs add api.ngocquanwd.com --app la-wed-backend

# Get DNS records to configure
flyctl certs show api.ngocquanwd.com --app la-wed-backend

# Update DNS with your provider
# Add CNAME record: api.ngocquanwd.com → la-wed-backend.fly.dev

# Verify SSL certificate
flyctl certs check api.ngocquanwd.com --app la-wed-backend
```

---

## Part 6: Cleanup Old Infrastructure

### ⚠️ Important: Complete this ONLY after verifying the new setup works perfectly

### Step 6.1: Document Old Setup (✅ Already Done)

The old setup has been documented in `ARCHIVE-SUPABASE-RENDER-SETUP.md`.

### Step 6.2: Keep Running for 1 Week

**Recommendation:** Keep both systems running for 1 week to ensure stability.

- Monitor Fly.io performance
- Compare metrics with old system
- Have rollback option available

### Step 6.3: Cleanup Render.com

After 1 week of stable operation:

1. Go to https://dashboard.render.com
2. Navigate to your service: `la-wed-backend`
3. Click "Settings" → "Delete Service"
4. Confirm deletion

### Step 6.4: Cleanup Supabase (Optional)

**⚠️ Warning:** Only do this after successful migration and backup verification.

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → General
4. Scroll to "Danger Zone"
5. Click "Pause Project" (or "Delete Project" if you're sure)

**Note:** Consider keeping Supabase paused for 1 month before permanent deletion.

### Step 6.5: Remove Render-Specific Files

```bash
# Remove render.yaml
git rm render.yaml

# Commit changes
git add .
git commit -m "chore: remove Render.com configuration after migration to Fly.io"
git push origin main
```

---

## Rollback Plan

If issues occur during migration, you can rollback:

### Quick Rollback (During Migration)

1. Update frontend to use old API URL
2. Keep Supabase and Render.com running
3. No data loss (both databases have same data)

### Full Rollback (After Migration)

1. Restore Supabase database from backup
2. Redeploy to Render.com using archived documentation
3. Update frontend API URL
4. Delete Fly.io resources

See `ARCHIVE-SUPABASE-RENDER-SETUP.md` for detailed rollback instructions.

---

## Troubleshooting

### Issue 1: Database Connection Failed

**Symptoms:**
```json
{
  "success": false,
  "error": "Failed to connect to database"
}
```

**Solution:**
```bash
# Check database status
flyctl status --app la-wed-database

# Check database logs
flyctl logs --app la-wed-database

# Verify connection string
flyctl secrets list --app la-wed-backend

# Test connection directly
flyctl postgres connect -a la-wed-database
```

### Issue 2: Migration Deployment Failed

**Symptoms:**
```
Error: failed to deploy
```

**Solution:**
```bash
# Check deployment logs
flyctl logs --app la-wed-backend

# Verify Dockerfile builds locally
docker build -t test-build .

# Check secrets are set
flyctl secrets list --app la-wed-backend

# Redeploy with verbose output
flyctl deploy --app la-wed-backend --verbose
```

### Issue 3: Application Won't Start

**Symptoms:**
- App shows as "unhealthy"
- Health checks failing

**Solution:**
```bash
# Check application logs
flyctl logs --app la-wed-backend

# SSH into machine
flyctl ssh console --app la-wed-backend

# Check environment variables
env | grep DATABASE

# Test database connection manually
cd /usr/src/app
node -e "import('./src/utils/database.js').then(m => m.checkDatabaseConnection().then(console.log))"
```

### Issue 4: Prisma Migrations Failed

**Symptoms:**
```
Error: Migration failed
```

**Solution:**
```bash
# SSH into app
flyctl ssh console --app la-wed-backend

# Check migration status
cd /usr/src/app
npm run prisma:migrate status

# Reset migrations (⚠️ DESTRUCTIVE)
npm run prisma:migrate reset

# Or apply migrations manually
npm run prisma:migrate:deploy
```

### Issue 5: CORS Errors

**Symptoms:**
- Frontend can't connect to API
- CORS errors in browser console

**Solution:**
```bash
# Check CORS_ORIGIN is set correctly
flyctl secrets list --app la-wed-backend

# Update if needed
flyctl secrets set CORS_ORIGIN="https://ngocquanwd.com" --app la-wed-backend

# Restart app
flyctl apps restart la-wed-backend
```

---

## Definition of Done

### ✅ Migration Success Criteria

- [ ] Fly.io PostgreSQL database created and accessible
- [ ] All data migrated from Supabase to Fly.io
- [ ] Application deployed to Fly.io successfully
- [ ] Health endpoint returns 200 OK
- [ ] Database connection working
- [ ] All API endpoints functional
- [ ] Frontend can connect to new API
- [ ] No cold start issues
- [ ] Response times < 500ms
- [ ] Logs showing no errors
- [ ] Metrics dashboard accessible
- [ ] Automatic restarts working
- [ ] Database backups configured
- [ ] SSL certificates active
- [ ] Old setup documented in archive file
- [ ] Monitoring alerts configured (optional)

### 📊 Performance Benchmarks

After migration, verify these improvements:

| Metric | Old (Render) | New (Fly.io) | Status |
|--------|--------------|--------------|--------|
| Cold start | 30-60s | 0s | ✅ |
| Response time | 200-500ms | < 200ms | ✅ |
| Uptime | ~95% | > 99% | ✅ |
| Database latency | 10-50ms | < 10ms | ✅ |
| Instance failures | 3-5/day | 0/day | ✅ |

---

## Additional Resources

### Fly.io Documentation
- [Fly.io Overview](https://fly.io/docs/)
- [Fly.io PostgreSQL](https://fly.io/docs/postgres/)
- [Fly.io Apps](https://fly.io/docs/apps/)
- [Fly.io Secrets](https://fly.io/docs/reference/secrets/)
- [Fly.io Monitoring](https://fly.io/docs/metrics-and-logs/)

### Support
- Fly.io Community: https://community.fly.io/
- GitHub Issues: https://github.com/eddienguyen/la-wed-be/issues
- Fly.io Status: https://status.fly.io/

---

## Next Steps After Migration

1. **Monitor for 1 week** - Ensure stability
2. **Setup alerts** - Configure monitoring alerts
3. **Document changes** - Update team documentation
4. **Optimize performance** - Fine-tune VM resources
5. **Setup backups** - Configure automated backups
6. **Cleanup old infra** - Remove Render/Supabase after verification

---

**Migration Guide Version:** 1.0  
**Last Updated:** 2025-10-17  
**Maintainer:** GitHub Copilot Agent

*For questions or issues, please open a GitHub issue or contact the team.*
