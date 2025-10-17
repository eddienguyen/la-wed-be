# Fly.io Quick Reference

Quick reference card for common Fly.io operations.

## 🚀 Deployment Commands

```bash
# Deploy application
flyctl deploy --app la-wed-backend

# Deploy with verbose output
flyctl deploy --app la-wed-backend --verbose

# Deploy and watch logs
flyctl deploy --app la-wed-backend && flyctl logs --app la-wed-backend
```

## 📊 Monitoring & Logs

```bash
# View real-time logs
flyctl logs --app la-wed-backend

# View database logs
flyctl logs --app la-wed-database

# View application status
flyctl status --app la-wed-backend

# View database status
flyctl status --app la-wed-database

# Open dashboard in browser
flyctl dashboard --app la-wed-backend

# View metrics
flyctl dashboard metrics --app la-wed-backend
```

## 🗄️ Database Operations

```bash
# Connect to database
flyctl postgres connect -a la-wed-database

# Create proxy to access database locally
flyctl proxy 15432:5432 -a la-wed-database

# Connect via psql through proxy
psql "postgres://postgres:[PASSWORD]@localhost:15432/la_wed_database"

# View database info
flyctl postgres info --app la-wed-database

# List database users
flyctl postgres users list --app la-wed-database

# Create database backup
flyctl postgres backup create --app la-wed-database

# List backups
flyctl postgres backup list --app la-wed-database
```

## 🔧 Application Management

```bash
# SSH into application
flyctl ssh console --app la-wed-backend

# Run command in application
flyctl ssh console --app la-wed-backend --command "npm run prisma:migrate:deploy"

# Scale application (increase machines)
flyctl scale count 2 --app la-wed-backend

# Scale resources (increase memory)
flyctl scale memory 512 --app la-wed-backend

# Restart application
flyctl apps restart la-wed-backend

# View releases
flyctl releases --app la-wed-backend
```

## 🔐 Secrets Management

```bash
# List secrets
flyctl secrets list --app la-wed-backend

# Set single secret
flyctl secrets set SECRET_NAME="value" --app la-wed-backend

# Set multiple secrets
flyctl secrets set \
  SECRET1="value1" \
  SECRET2="value2" \
  --app la-wed-backend

# Unset secret
flyctl secrets unset SECRET_NAME --app la-wed-backend

# Import secrets from file
flyctl secrets import --app la-wed-backend < secrets.txt
```

## 🌐 DNS & Domains

```bash
# Add custom domain
flyctl certs add api.ngocquanwd.com --app la-wed-backend

# View certificates
flyctl certs list --app la-wed-backend

# Check certificate status
flyctl certs show api.ngocquanwd.com --app la-wed-backend

# Remove domain
flyctl certs remove api.ngocquanwd.com --app la-wed-backend
```

## 🔄 Version Control

```bash
# View releases
flyctl releases --app la-wed-backend

# Rollback to previous version
flyctl releases rollback v1 --app la-wed-backend

# View release details
flyctl releases info v2 --app la-wed-backend
```

## 🧪 Testing & Debugging

```bash
# Test health endpoint
curl https://la-wed-backend.fly.dev/api/health

# Test database health
curl https://la-wed-backend.fly.dev/api/health/database

# Check response headers
curl -I https://la-wed-backend.fly.dev/api/health

# Test CORS
curl -X OPTIONS https://la-wed-backend.fly.dev/api/guests \
  -H "Origin: https://ngocquanwd.com" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

## 📦 Machine Management

```bash
# List machines
flyctl machine list --app la-wed-backend

# Stop machine
flyctl machine stop [MACHINE_ID] --app la-wed-backend

# Start machine
flyctl machine start [MACHINE_ID] --app la-wed-backend

# Destroy machine (⚠️ DANGER)
flyctl machine destroy [MACHINE_ID] --app la-wed-backend
```

## 🔍 Information Commands

```bash
# View app info
flyctl info --app la-wed-backend

# View app configuration
flyctl config show --app la-wed-backend

# View regions
flyctl platform regions

# View VM sizes
flyctl platform vm-sizes

# View account info
flyctl auth whoami
```

## 🏗️ Setup & Initialization

```bash
# Login to Fly.io
flyctl auth login

# Logout
flyctl auth logout

# Create new app
flyctl apps create la-wed-backend

# Destroy app (⚠️ DANGER)
flyctl apps destroy la-wed-backend

# List all apps
flyctl apps list

# Create PostgreSQL database
flyctl postgres create --name la-wed-database

# Attach database to app
flyctl postgres attach la-wed-database --app la-wed-backend
```

## 🚨 Emergency Commands

```bash
# Force restart application
flyctl apps restart la-wed-backend --force

# View recent errors
flyctl logs --app la-wed-backend | grep -i error

# Check all health checks
flyctl checks list --app la-wed-backend

# SSH and check processes
flyctl ssh console --app la-wed-backend --command "ps aux"

# Check disk usage
flyctl ssh console --app la-wed-backend --command "df -h"

# Check memory usage
flyctl ssh console --app la-wed-backend --command "free -h"
```

## 📝 Useful One-Liners

```bash
# Deploy and watch logs
flyctl deploy --app la-wed-backend && flyctl logs --app la-wed-backend

# Quick health check
curl -s https://la-wed-backend.fly.dev/api/health | jq .

# Check if app is responding
curl -sS -o /dev/null -w "%{http_code}" https://la-wed-backend.fly.dev/api/health

# Follow logs with grep filter
flyctl logs --app la-wed-backend | grep -E "error|warning|failed"

# View last 100 log lines
flyctl logs --app la-wed-backend | tail -100

# Check database connection
flyctl ssh console --app la-wed-backend --command "node -e \"import('./src/utils/database.js').then(m => m.checkDatabaseConnection().then(console.log))\""
```

## 🔗 Useful Links

- **Dashboard**: https://fly.io/dashboard
- **Apps**: https://fly.io/apps
- **Docs**: https://fly.io/docs/
- **Community**: https://community.fly.io/
- **Status**: https://status.fly.io/

## 📱 Fly.io CLI Help

```bash
# General help
flyctl help

# Help for specific command
flyctl deploy --help
flyctl postgres --help
flyctl secrets --help
```

## 🛠️ Project-Specific Commands

```bash
# Using our deployment script
./scripts/deploy-flyio.sh setup      # Initial setup
./scripts/deploy-flyio.sh deploy     # Deploy app
./scripts/deploy-flyio.sh migrate    # Run migrations
./scripts/deploy-flyio.sh status     # Check status
./scripts/deploy-flyio.sh logs       # View logs
./scripts/deploy-flyio.sh rollback   # Rollback

# Using our cleanup script (post-migration)
./scripts/cleanup-old-setup.sh       # Remove old files
```

## 💡 Tips & Tricks

### 1. Quick Deploy & Test
```bash
flyctl deploy --app la-wed-backend && \
  sleep 5 && \
  curl https://la-wed-backend.fly.dev/api/health
```

### 2. Watch Logs During Deploy
```bash
# Terminal 1
flyctl deploy --app la-wed-backend

# Terminal 2 (run simultaneously)
flyctl logs --app la-wed-backend
```

### 3. Database Connection String
```bash
# Get from environment
flyctl ssh console --app la-wed-backend --command "echo \$DATABASE_URL"
```

### 4. Quick Migrations
```bash
flyctl ssh console --app la-wed-backend << 'EOF'
cd /usr/src/app
npm run prisma:migrate:deploy
exit
EOF
```

### 5. Check All Services
```bash
echo "App Status:" && \
flyctl status --app la-wed-backend && \
echo -e "\nDB Status:" && \
flyctl status --app la-wed-database
```

---

**Quick Reference Version:** 1.0  
**Last Updated:** 2025-10-17  
**For:** la-wed-backend on Fly.io
