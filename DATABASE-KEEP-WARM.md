# Database Keep-Warm Setup Guide

## Overview
This GitHub Actions workflow keeps the Supabase database active to prevent the free tier from pausing due to inactivity.

## Setup Steps

### 1. Add GitHub Secret

1. **Navigate to your repository on GitHub:**
   - Go to: `https://github.com/eddienguyen/la-wed-be` (or your actual repo)

2. **Access Repository Settings:**
   - Click on **Settings** tab (top menu)
   - In the left sidebar, click **Secrets and variables** → **Actions**

3. **Create New Secret:**
   - Click **New repository secret**
   - Name: `SUPABASE_DATABASE_URL`
   - Value: (copy from below)

```
postgresql://postgres.opkvkiaaqjhlfmijyzer:dAztef-cidxy6-gubvux@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

4. **Save the Secret:**
   - Click **Add secret**

### 2. Commit and Push the Workflow

From your terminal:

```bash
cd /Users/eddienguyen/Documents/cw/Web-frameworks/la-wed

# Check the new workflow file
cat .github/workflows/keep-db-warm.yml

# Add to git
git add .github/workflows/keep-db-warm.yml
git add docs/DATABASE-KEEP-WARM.md

# Commit
git commit -m "Add GitHub Actions workflow to keep Supabase database warm"

# Push to GitHub
git push origin main
```

### 3. Verify the Workflow

1. **Go to GitHub Actions:**
   - Navigate to: `https://github.com/eddienguyen/la-wed-be/actions`
   - You should see "Keep Supabase Database Warm" workflow

2. **Manually Trigger (First Test):**
   - Click on the workflow name
   - Click **Run workflow** dropdown (top right)
   - Click **Run workflow** button
   - Wait 30-60 seconds for it to complete

3. **Check Results:**
   - Click on the running/completed workflow
   - Click on the "ping-database" job
   - Review the logs - you should see:
     - ✅ Database health check result
     - ✅ Guest count statistics
     - ✅ Success message with timestamp

### 4. Schedule Confirmation

The workflow will now run automatically:
- **Every 4 hours** (6 times per day)
- **Times**: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
- This keeps the database active 24/7

**UTC to Your Timezone:**
- If you're in Vietnam (UTC+7):
  - 00:00 UTC = 07:00 Vietnam
  - 04:00 UTC = 11:00 Vietnam
  - 08:00 UTC = 15:00 Vietnam
  - 12:00 UTC = 19:00 Vietnam
  - 16:00 UTC = 23:00 Vietnam
  - 20:00 UTC = 03:00 Vietnam

## What the Workflow Does

1. **Installs PostgreSQL client** on the GitHub Actions runner
2. **Executes health check query:**
   ```sql
   SELECT 1 as health_check, 
          NOW() as timestamp,
          current_database() as database,
          version() as postgres_version;
   ```
3. **Queries guest statistics:**
   ```sql
   SELECT COUNT(*) as total_guests,
          COUNT(CASE WHEN venue = 'hue' THEN 1 END) as hue_guests,
          COUNT(CASE WHEN venue = 'hanoi' THEN 1 END) as hanoi_guests
   FROM "Guest";
   ```
4. **Reports success/failure** to GitHub Actions UI

## Benefits

✅ **Prevents database pausing** - Supabase won't pause due to inactivity  
✅ **Zero cost** - GitHub Actions is free for public repos (2000 minutes/month)  
✅ **Automatic** - Runs on schedule, no manual intervention  
✅ **Monitoring** - GitHub Actions UI shows all runs and any failures  
✅ **Flexible** - Can manually trigger anytime from GitHub UI  

## Troubleshooting

### Workflow Fails with "Can't reach database"
- The database might be pausing despite the pings
- Solution: Change cron to run every 2 hours instead:
  ```yaml
  - cron: '0 */2 * * *'  # Every 2 hours
  ```

### Secret Not Found Error
- Verify the secret name is exactly: `SUPABASE_DATABASE_URL`
- Check that you added it to the correct repository
- Make sure the workflow file is on the `main` branch

### Need More Frequent Pings
- Adjust the cron schedule:
  ```yaml
  - cron: '0 * * * *'  # Every 1 hour
  - cron: '*/30 * * * *'  # Every 30 minutes
  ```

## Monitoring

To check workflow runs:
1. Go to: `https://github.com/eddienguyen/la-wed-be/actions`
2. Filter by workflow: "Keep Supabase Database Warm"
3. Review recent runs for any failures

## Cost Analysis

- **GitHub Actions Free Tier**: 2,000 minutes/month
- **This workflow usage**: ~6 minutes/day = ~180 minutes/month
- **Remaining budget**: 1,820 minutes for other workflows
- **Cost**: $0

## Next Steps After Setup

Once the workflow is running:
1. ✅ Database will stay warm permanently
2. ✅ Your local backend development will work without connection issues
3. ✅ Production API on Fly.io continues working smoothly
4. ✅ No more "Can't reach database server" errors

---

**Created**: October 19, 2025  
**Purpose**: Prevent Supabase free tier database pausing  
**Status**: Active
