#!/bin/bash

# Fix Supabase Connection for Fly.io
# This script updates Fly.io secrets to use the correct Supabase pooler connection

echo "🔧 Updating Fly.io database connection secrets..."

# Set DATABASE_URL to use pooler (port 6543) with pgbouncer
flyctl secrets set DATABASE_URL="postgresql://postgres.opkvkiaaqjhlfmijyzer:dAztef-cidxy6-gubvux@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Set DIRECT_URL to use direct connection (port 5432) for migrations only
flyctl secrets set DIRECT_URL="postgresql://postgres.opkvkiaaqjhlfmijyzer:dAztef-cidxy6-gubvux@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

echo "✅ Secrets updated! App will restart automatically."
echo ""
echo "📝 Wait 30-60 seconds for restart, then test:"
echo "curl https://ngocquan-wedding-api.fly.dev/api/health"
