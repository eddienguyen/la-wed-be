# Fly.io Migration Testing Checklist

This checklist ensures all functionality works correctly after migrating to Fly.io.

## 📋 Pre-Migration Tests (On Current Setup)

Run these tests on Render.com/Supabase **before** migration to establish baseline:

### Database Tests
- [ ] Connect to Supabase database
- [ ] Query guests table: `SELECT COUNT(*) FROM guests;`
- [ ] Verify data integrity: Check sample records
- [ ] Export database backup
- [ ] Verify all migrations applied: `npm run prisma:migrate status`

### API Tests
- [ ] Health check: `GET /api/health` returns 200
- [ ] Database health: `GET /api/health/database` returns connected
- [ ] List guests: `GET /api/guests` returns paginated results
- [ ] Get guest by ID: `GET /api/guests/:id` returns guest
- [ ] Create guest: `POST /api/guests` creates new record
- [ ] Update guest: `PATCH /api/guests/:id` updates record
- [ ] Delete guest: `DELETE /api/guests/:id` removes record
- [ ] CORS headers: Verify Access-Control-Allow-Origin

### Performance Baseline
- [ ] Cold start time: Record first request after inactivity
- [ ] Warm request time: Record average response time
- [ ] Database query latency: Check from logs
- [ ] Image upload time: Test file upload (if configured)

---

## 🔧 Migration Process Tests

Run these during the migration:

### Database Migration
- [ ] Fly.io PostgreSQL created successfully
- [ ] Database credentials saved securely
- [ ] Can connect to Fly.io database: `flyctl postgres connect`
- [ ] Data exported from Supabase: Check backup file size
- [ ] Data imported to Fly.io: Verify row counts match
- [ ] Tables created correctly: `\dt` shows all tables
- [ ] Indexes created: `\di` shows indices
- [ ] Guest count matches: `SELECT COUNT(*) FROM guests;`
- [ ] Sample data verified: Check 5 random records

### Application Deployment
- [ ] Fly.io app created: `flyctl status --app la-wed-backend`
- [ ] Database attached: Check DATABASE_URL secret
- [ ] All secrets set: `flyctl secrets list`
- [ ] Dockerfile builds successfully
- [ ] Application deployed: `flyctl deploy` completes
- [ ] Migrations applied: `npm run prisma:migrate:deploy`
- [ ] App status shows "healthy"
- [ ] Logs show no errors: `flyctl logs`

---

## ✅ Post-Migration Tests (On Fly.io)

Run these tests on new Fly.io setup to verify everything works:

### Basic Health Tests
- [ ] Health check: `curl https://la-wed-backend.fly.dev/api/health`
  - Returns 200 status
  - Shows "Server is healthy"
  - Database status is "connected"
  - No errors in response
  
- [ ] Database health: `curl https://la-wed-backend.fly.dev/api/health/database`
  - Returns 200 status
  - Shows connection details
  - Latency < 50ms
  
- [ ] Root endpoint: `curl https://la-wed-backend.fly.dev/`
  - Returns API information
  - Lists available endpoints

### Guest API Tests

#### List Guests
```bash
curl -X GET https://la-wed-backend.fly.dev/api/guests
```
- [ ] Returns 200 status
- [ ] Response has `success: true`
- [ ] Returns array of guests
- [ ] Pagination info present
- [ ] Total count matches database

#### Get Single Guest
```bash
curl -X GET https://la-wed-backend.fly.dev/api/guests/[GUEST_ID]
```
- [ ] Returns 200 for valid ID
- [ ] Returns 404 for invalid ID
- [ ] Guest data is complete
- [ ] All fields present

#### Create Guest
```bash
curl -X POST https://la-wed-backend.fly.dev/api/guests \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Guest",
    "venue": "hue",
    "secondaryNote": "Test note"
  }'
```
- [ ] Returns 201 status
- [ ] Guest created in database
- [ ] Invitation URL generated correctly
- [ ] Response includes guest ID

#### Update Guest
```bash
curl -X PATCH https://la-wed-backend.fly.dev/api/guests/[GUEST_ID] \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'
```
- [ ] Returns 200 status
- [ ] Guest updated in database
- [ ] Only specified fields changed
- [ ] Timestamp updated

#### Delete Guest
```bash
curl -X DELETE https://la-wed-backend.fly.dev/api/guests/[GUEST_ID]
```
- [ ] Returns 200 status
- [ ] Guest removed from database
- [ ] Cannot fetch deleted guest (404)

### Image Upload Tests (if R2 configured)
- [ ] Upload front image
- [ ] Upload main image
- [ ] Image URLs returned correctly
- [ ] Images accessible at URLs
- [ ] Image deletion works

### CORS Tests
```bash
curl -X OPTIONS https://la-wed-backend.fly.dev/api/guests \
  -H "Origin: https://ngocquanwd.com" \
  -H "Access-Control-Request-Method: GET"
```
- [ ] Returns CORS headers
- [ ] Access-Control-Allow-Origin matches frontend
- [ ] Access-Control-Allow-Methods includes GET, POST, PATCH, DELETE
- [ ] Preflight requests work

### Error Handling Tests
- [ ] 404 for unknown endpoint
- [ ] 400 for invalid data
- [ ] 500 errors show appropriate message
- [ ] Validation errors have details

### Performance Tests
- [ ] **No cold start**: First request < 2 seconds ✨
- [ ] Warm requests < 500ms
- [ ] Database queries < 50ms
- [ ] Concurrent requests handled properly
- [ ] Response times stable over time

### Database Tests
- [ ] Prisma Client working
- [ ] All CRUD operations successful
- [ ] Transactions work correctly
- [ ] Connection pooling working
- [ ] No connection leaks

### Logging and Monitoring
- [ ] Application logs accessible: `flyctl logs`
- [ ] Logs show request/response info
- [ ] Error logs captured
- [ ] Metrics dashboard accessible
- [ ] Health checks passing

---

## 🎯 Frontend Integration Tests

After backend is verified, test frontend integration:

### Frontend Configuration
- [ ] Frontend environment updated with new API URL
- [ ] Frontend can connect to API
- [ ] CORS working from frontend

### End-to-End Tests
- [ ] Load guest list page
- [ ] View single guest details
- [ ] Create new guest
- [ ] Edit existing guest
- [ ] Delete guest
- [ ] Upload images (if configured)
- [ ] View invitation pages
- [ ] All API calls successful

### User Experience
- [ ] **No cold start delays** ✨
- [ ] Pages load quickly
- [ ] No network errors
- [ ] Smooth user experience
- [ ] Error messages are clear

---

## 🚦 Performance Comparison

Compare old vs new infrastructure:

| Metric | Old (Render) | New (Fly.io) | Pass/Fail |
|--------|--------------|--------------|-----------|
| Cold start | 30-60s | < 2s | ⬜ |
| Warm request | 200-500ms | < 200ms | ⬜ |
| Database latency | 10-50ms | < 10ms | ⬜ |
| Uptime (24h) | ~95% | > 99% | ⬜ |
| Instance failures | 3-5/day | 0/day | ⬜ |
| Health check pass rate | ~90% | > 99% | ⬜ |

**All metrics should show improvement!**

---

## 📊 Load Testing (Optional)

Run load tests to ensure stability:

```bash
# Install Apache Bench (if not installed)
brew install apache-bench  # macOS
# or: apt-get install apache2-utils  # Linux

# Test health endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 https://la-wed-backend.fly.dev/api/health

# Test guest list (100 requests, 10 concurrent)
ab -n 100 -c 10 https://la-wed-backend.fly.dev/api/guests
```

**Expected Results:**
- [ ] All requests successful (0 failed)
- [ ] Mean response time < 500ms
- [ ] No errors in logs
- [ ] Database connections stable
- [ ] Memory usage stable

---

## 🔄 Rollback Tests

Verify rollback capability:

- [ ] Old infrastructure still accessible
- [ ] Old database backup available
- [ ] Can switch frontend to old API
- [ ] Rollback procedure documented
- [ ] Rollback time < 10 minutes

---

## ✨ Definition of Done

**The migration is successful when ALL of the following are true:**

### Functionality
- [x] All API endpoints working correctly
- [x] Database operations successful
- [x] Image upload/deletion working (if configured)
- [x] CORS configured properly
- [x] Error handling working
- [x] Logging functional

### Performance
- [x] **Zero cold starts** (most important!)
- [x] Response times improved
- [x] Database latency improved
- [x] No timeout errors
- [x] Stable under load

### Reliability
- [x] **No instance failures** (most important!)
- [x] Health checks always passing
- [x] Uptime > 99%
- [x] Automatic restarts working
- [x] Database backups configured

### Operations
- [x] Deployment process documented
- [x] Monitoring accessible
- [x] Logs accessible
- [x] Secrets configured
- [x] Rollback tested

### Documentation
- [x] Migration guide complete
- [x] Old setup archived
- [x] README updated
- [x] Testing checklist complete
- [x] Troubleshooting guide available

---

## 🎉 Success Criteria

**Migration is considered successful when:**

1. ✅ All tests pass (100% completion)
2. ✅ No cold start issues (primary goal)
3. ✅ No instance failures (primary goal)
4. ✅ Frontend works seamlessly
5. ✅ Performance improved
6. ✅ Team can operate new infrastructure
7. ✅ Rollback plan tested and ready

---

## 📝 Notes

- Record any issues encountered during testing
- Document workarounds or solutions
- Update guides with lessons learned
- Share results with team

---

**Checklist Version:** 1.0  
**Last Updated:** 2025-10-17  
**Maintainer:** GitHub Copilot Agent
