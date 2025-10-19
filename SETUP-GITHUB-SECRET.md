## 🎯 NEXT STEPS - Add GitHub Secret

### ✅ Step 1: Navigate to GitHub Settings

1. Open this URL in your browser:
   ```
   https://github.com/eddienguyen/la-wed-be/settings/secrets/actions
   ```

2. Or manually navigate:
   - Go to: https://github.com/eddienguyen/la-wed-be
   - Click **Settings** (top menu)
   - Click **Secrets and variables** → **Actions** (left sidebar)

---

### ✅ Step 2: Add the Database Secret

1. Click the **"New repository secret"** button (green button, top right)

2. Fill in the form:
   - **Name**: `SUPABASE_DATABASE_URL_POOLED` (copy this exactly!)
   - **Secret**: (copy the value below - **Note: Uses port 6543 with pgbouncer**)

```
postgresql://postgres.opkvkiaaqjhlfmijyzer:dAztef-cidxy6-gubvux@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

3. Click **"Add secret"** button

---

### ✅ Step 3: Test the Workflow

1. Go to GitHub Actions:
   ```
   https://github.com/eddienguyen/la-wed-be/actions
   ```

2. You should see "Keep Supabase Database Warm" in the workflows list

3. Click on the workflow name

4. Click **"Run workflow"** dropdown (top right, gray button)

5. Click **"Run workflow"** in the dropdown

6. Wait 30-60 seconds, then refresh the page

7. Click on the workflow run to see the logs

8. Expected output:
   ```
   🔄 Pinging Supabase database to keep it warm...
   health_check | timestamp           | database | postgres_version
   --------------+---------------------+----------+------------------
              1 | 2025-10-19 08:XX:XX | postgres | PostgreSQL 15.x...
   
   total_guests | hue_guests | hanoi_guests
   --------------+------------+--------------
             41 |         20 |           21
   
   ✅ Database is warm and responding
   📊 Timestamp: 2025-10-19 08:XX:XX UTC
   ```

---

### ✅ Step 4: Verify Schedule

The workflow will now run automatically:
- **Every 4 hours**
- **Times**: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
- **Vietnam Time**: 07:00, 11:00, 15:00, 19:00, 23:00, 03:00

Check it tomorrow to confirm it's running on schedule!

---

## 🎉 What You've Accomplished

✅ **Workflow Created** - GitHub Actions file committed and pushed  
✅ **Documentation Added** - Full setup guide in `DATABASE-KEEP-WARM.md`  
✅ **Zero Cost Solution** - Free tier GitHub Actions keeps database warm  
✅ **Automatic Operation** - Runs every 4 hours without manual intervention  

## 🔧 Troubleshooting

**If the workflow fails:**
1. Check the secret name is exactly: `SUPABASE_DATABASE_URL_POOLED`
2. Verify the secret value has no extra spaces
3. Make sure you're using **port 6543** (not 5432)
4. Ensure the URL includes `?pgbouncer=true` at the end
5. Make sure you're in the correct repository: `la-wed-be`

**If database still pauses:**
1. Reduce interval to every 2 hours:
   - Edit `.github/workflows/keep-db-warm.yml`
   - Change `'0 */4 * * *'` to `'0 */2 * * *'`
   - Commit and push

---

## 📝 Current Status

- ✅ Workflow file created
- ✅ Committed to GitHub
- ✅ Pushed to repository
- ⏳ **NEXT**: Add the GitHub secret (follow Step 2 above)
- ⏳ **THEN**: Manually test the workflow (follow Step 3 above)

---

**Once the secret is added and workflow tested successfully, your database will stay warm 24/7!**
