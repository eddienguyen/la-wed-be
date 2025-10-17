#!/bin/bash
# Quick migration script before trial timeout
set -e

FLYIO_URL="postgres://postgres:uB0KVIwZ20Bx1i7@localhost:5432/postgres"

echo "=== Quick Fly.io Migration (5min trial limit!) ==="
echo ""

# Start proxy in background
echo "Starting proxy..."
flyctl proxy 5432:5432 -a ngocquan-wedding-db > /tmp/proxy.log 2>&1 &
PROXY_PID=$!
sleep 3

# Run migrations
echo "Running migrations..."
DATABASE_URL="$FLYIO_URL" DIRECT_URL="$FLYIO_URL" npx prisma migrate deploy

# Import data
echo "Importing data..."
DATABASE_URL="$FLYIO_URL" node scripts/import-data-flyio.js

# Cleanup
kill $PROXY_PID 2>/dev/null || true

echo ""
echo "=== Migration Complete! ==="
echo "⚠️  Remember: Trial machines stop after 5 minutes. Add credit card to keep running."
