# Archive: Supabase + Render.com Setup Documentation

**ARCHIVED ON:** 2025-10-17

This document contains all information about the previous backend infrastructure setup using Supabase (database) and Render.com (hosting). This archive is maintained for reference in case a rollback is needed.

---

## 🏗️ Previous Architecture Overview

### **Database: Supabase PostgreSQL**
- **Provider:** Supabase (https://supabase.com)
- **Database Type:** PostgreSQL with PgBouncer connection pooling
- **Region:** ap-southeast-1 (AWS Singapore)
- **Tier:** Free tier

### **Hosting: Render.com**
- **Provider:** Render.com (https://render.com)
- **Service Type:** Web Service
- **Region:** Singapore
- **Plan:** Free tier

---

## 🗄️ Database Configuration (Supabase)

### Connection Details

Supabase provides two types of connection strings:

#### 1. **Transaction Mode (Port 6543)** - Used for DATABASE_URL
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```
- Uses PgBouncer in transaction mode
- Connection pooling enabled
- Requires `?pgbouncer=true` parameter to prevent prepared statement errors
- Used for most database operations

#### 2. **Session Mode (Port 5432)** - Used for DIRECT_URL
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```
- Direct PostgreSQL connection
- No connection pooling
- Required for migrations and schema operations
- Used by Prisma for migrations

### Environment Variables

```env
# Database Configuration
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://[PROJECT_REF].supabase.com
POSTGRES_DB=wedding-guest-management
```

### Database Schema

#### Guest Table
```sql
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  secondary_note VARCHAR(200),
  venue VARCHAR NOT NULL CHECK (venue IN ('hue', 'hanoi')),
  invitation_url VARCHAR(255) NOT NULL,
  invitation_image_front_url VARCHAR(255),
  invitation_image_main_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_guests_venue ON guests(venue);
CREATE INDEX idx_guests_created_at ON guests(created_at);
```

### PgBouncer Compatibility Fix

The application automatically detects Supabase transaction mode and adds the `pgbouncer=true` parameter:

```javascript
// From src/utils/database.js
if (dbUrl && dbUrl.includes(':6543') && !dbUrl.includes('pgbouncer=true')) {
  const separator = dbUrl.includes('?') ? '&' : '?'
  dbUrl = `${dbUrl}${separator}pgbouncer=true`
  console.log('🔧 [Database] Detected Supabase transaction mode - enabling PgBouncer compatibility')
}
```

This prevents the "prepared statement already exists" error that occurs with Supabase's PgBouncer transaction mode.

---

## 🚀 Hosting Configuration (Render.com)

### Service Configuration

#### render.yaml Blueprint
```yaml
services:
  - type: web
    name: la-wed-backend
    runtime: node
    region: singapore
    plan: free
    rootDir: backend
    buildCommand: npm install && npm run prisma:generate
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DATABASE_URL
        sync: false  # Managed in Render dashboard
      - key: DIRECT_URL
        sync: false  # Managed in Render dashboard
      - key: CORS_ORIGIN
        sync: false  # Managed in Render dashboard
      - key: LOG_LEVEL
        value: info
```

### Environment Variables on Render

Set in Render Dashboard under Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` | Application port |
| `DATABASE_URL` | Supabase connection string (transaction mode) | From Supabase dashboard |
| `DIRECT_URL` | Supabase connection string (session mode) | From Supabase dashboard |
| `CORS_ORIGIN` | `https://ngocquanwd.com` | Frontend URL |
| `LOG_LEVEL` | `info` | Logging level |
| `R2_ENDPOINT` | Cloudflare R2 endpoint | Optional: for image storage |
| `R2_ACCESS_KEY_ID` | R2 access key | Optional: for image storage |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | Optional: for image storage |
| `R2_BUCKET_NAME` | R2 bucket name | Optional: for image storage |
| `R2_PUBLIC_URL` | R2 public URL | Optional: for image storage |
| `FRONTEND_URL` | `https://ngocquanwd.com` | For generating invitation URLs |

### Build and Deploy Process

1. **Build Command:** `npm install && npm run prisma:generate`
   - Installs dependencies
   - Generates Prisma Client

2. **Start Command:** `npm start`
   - Runs: `NODE_ENV=production node src/app.js`

3. **Deployment:**
   - Automatic deployment on git push to main branch
   - Manual deployment via Render dashboard
   - Deploys from GitHub repository

### Post-Deployment Steps

After initial deployment:
```bash
# Run database migrations
npm run prisma:migrate:deploy

# Test health endpoint
curl https://[your-app].onrender.com/api/health
```

---

## 📋 Known Issues with Supabase/Render.com Setup

### 1. **Cold Start Problem**
- **Issue:** Render.com free tier spins down after inactivity
- **Impact:** First API call after inactivity takes 30-60 seconds
- **User Experience:** Network errors, confusion, requires retry
- **Frequency:** Happens after 15 minutes of inactivity

### 2. **Instance Failures**
- **Issue:** Instance failures every few hours (from Render logs)
- **Impact:** Temporary service unavailability
- **Cause:** Render.com free tier limitations
- **Frequency:** Multiple times per day

### 3. **Database Connection Pooling**
- **Issue:** PgBouncer requires special configuration
- **Workaround:** Auto-detect and add `pgbouncer=true` parameter
- **Complexity:** Requires understanding of two connection modes

---

## 🔧 Application Architecture

### Technology Stack
- **Framework:** Express.js 5.1.0
- **Language:** JavaScript (ES Modules)
- **Database ORM:** Prisma 6.17.1
- **Database:** PostgreSQL 15
- **Image Storage:** AWS S3-compatible (Cloudflare R2)
- **Image Processing:** Sharp 0.34.4
- **Runtime:** Node.js 20.19.0

### Key Files
- `package.json` - Dependencies and scripts
- `src/app.js` - Express application setup
- `src/utils/database.js` - Database utilities with PgBouncer compatibility
- `src/routes/guests.js` - Guest CRUD API endpoints
- `src/routes/health.js` - Health check endpoints
- `src/services/imageService.js` - Image processing service
- `src/services/storageService.js` - Cloudflare R2 storage service
- `prisma/schema.prisma` - Database schema definition
- `render.yaml` - Render.com deployment configuration
- `Dockerfile` - Docker container configuration

### API Endpoints
- `GET /` - API information
- `GET /api/health` - Server and database health status
- `GET /api/health/database` - Database connection status
- `GET /api/guests` - List all guests (paginated)
- `GET /api/guests/:id` - Get guest by ID
- `POST /api/guests` - Create new guest with optional images
- `PATCH /api/guests/:id` - Update guest
- `DELETE /api/guests/:id` - Delete guest and associated images

---

## 📝 Setup Instructions (Historical Reference)

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (free tier)
- Render.com account (free tier)

### Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up / Log in
3. Create new project
4. Wait for project initialization (~2 minutes)
5. Go to Settings > Database
6. Copy connection strings:
   - Transaction mode (port 6543) → DATABASE_URL
   - Session mode (port 5432) → DIRECT_URL

### Step 2: Setup Render.com Service

1. Go to https://render.com
2. Sign up / Log in
3. Create new Web Service
4. Connect GitHub repository: `eddienguyen/la-wed-be`
5. Configure service:
   - Name: `la-wed-backend`
   - Region: Singapore
   - Branch: `main`
   - Root Directory: (leave empty or set to project root)
   - Build Command: `npm install && npm run prisma:generate`
   - Start Command: `npm start`
6. Add environment variables (see table above)
7. Click "Create Web Service"
8. Wait for initial deployment

### Step 3: Run Database Migrations

After first deployment, open Render Shell:
```bash
npm run prisma:migrate:deploy
```

### Step 4: Verify Deployment

Test health endpoint:
```bash
curl https://[your-app].onrender.com/api/health
```

Expected response:
```json
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
      "latency": "15ms",
      "timestamp": "2025-10-17T10:30:00Z"
    }
  }
}
```

---

## 🔄 Rollback Instructions

If you need to rollback from Fly.io to this setup:

### 1. Restore Supabase Database
- Supabase project may still exist (check dashboard)
- If deleted, create new project and restore from backup
- Run migrations: `npm run prisma:migrate:deploy`

### 2. Restore Render.com Service
- Render service may still exist (check dashboard)
- If deleted, follow setup instructions above
- Ensure environment variables are set correctly

### 3. Update Application Configuration
```bash
# Restore render.yaml
git checkout ARCHIVE-SUPABASE-RENDER-SETUP.md

# Update environment variables in Render dashboard
# Update CORS_ORIGIN to match your frontend
```

### 4. Deploy
```bash
git push origin main
# Or trigger manual deploy in Render dashboard
```

---

## 📊 Performance Metrics (Historical)

### Response Times (Singapore Region)
- Cold start: 30-60 seconds
- Warm request: 200-500ms
- Database query: 10-50ms

### Availability
- Uptime: ~95% (affected by free tier limitations)
- Cold starts per day: 20-30 times
- Instance failures: 3-5 times per day

### Resource Usage
- Memory: ~100-150 MB
- CPU: Minimal (Express.js is lightweight)
- Database connections: 1-2 (PgBouncer pooling)

---

## 🎯 Reasons for Migration

### Primary Issues
1. **Cold Start Problem:** Unacceptable UX for users (network errors, confusion)
2. **Instance Failures:** Service instability every few hours
3. **Reliability:** Free tier limitations affecting production usage

### Expected Improvements with Fly.io
1. **Always-on:** Fly.io Machines don't sleep
2. **Better Free Tier:** More reliable than Render.com free tier
3. **Integrated Database:** Fly.io Postgres with better performance
4. **Geographic Distribution:** Can deploy to multiple regions
5. **Better Monitoring:** Built-in metrics and logs

---

## 📚 Resources

### Documentation Links (Historical)
- [Supabase Documentation](https://supabase.com/docs)
- [Render Documentation](https://render.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Express.js Documentation](https://expressjs.com/)

### Repository
- GitHub: https://github.com/eddienguyen/la-wed-be

---

**End of Archive**

*This document should be kept for historical reference and potential rollback scenarios. All future development should use the new Fly.io infrastructure.*
