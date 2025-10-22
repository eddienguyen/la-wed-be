#!/bin/bash

##############################################################################
# Fly.io Secrets Validator
#
# Validates that production secrets on Fly.io are properly configured
# for Supabase pooler connections.
#
# Usage:
#   bash scripts/validate-flyio-secrets.sh
#
# Requirements:
#   - flyctl CLI installed and authenticated
#   - App name: ngocquan-wedding-api
##############################################################################

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_NAME="ngocquan-wedding-api"

echo -e "${BLUE}🔍 Validating Fly.io Production Secrets...${NC}\n"

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
  echo -e "${RED}❌ ERROR: flyctl CLI not found${NC}"
  echo -e "   Install: https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

# Check if authenticated
if ! flyctl auth whoami &> /dev/null; then
  echo -e "${RED}❌ ERROR: Not authenticated with Fly.io${NC}"
  echo -e "   Run: flyctl auth login"
  exit 1
fi

echo -e "${GREEN}✓${NC} flyctl CLI found and authenticated\n"

# Get secrets
echo -e "${BLUE}📋 Fetching secrets from ${APP_NAME}...${NC}"
SECRETS=$(flyctl secrets list -a $APP_NAME --json 2>/dev/null)

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ ERROR: Failed to fetch secrets${NC}"
  echo -e "   Check if app name is correct: $APP_NAME"
  exit 1
fi

HAS_ERRORS=0
HAS_WARNINGS=0

# Check DATABASE_URL
DATABASE_URL_DIGEST=$(echo "$SECRETS" | jq -r '.[] | select(.Name=="DATABASE_URL") | .Digest')

if [ -z "$DATABASE_URL_DIGEST" ] || [ "$DATABASE_URL_DIGEST" == "null" ]; then
  echo -e "${RED}❌ ERROR: DATABASE_URL secret not found${NC}"
  HAS_ERRORS=1
else
  echo -e "${GREEN}✓${NC} DATABASE_URL secret exists (digest: ${DATABASE_URL_DIGEST:0:8}...)"
  echo -e "${YELLOW}  ⚠️  Cannot validate content (secrets are encrypted)${NC}"
  echo -e "     Ensure it uses: port 6543, pgbouncer=true, connection_limit=1"
fi

# Check DIRECT_URL
DIRECT_URL_DIGEST=$(echo "$SECRETS" | jq -r '.[] | select(.Name=="DIRECT_URL") | .Digest')

if [ -z "$DIRECT_URL_DIGEST" ] || [ "$DIRECT_URL_DIGEST" == "null" ]; then
  echo -e "${YELLOW}⚠️  WARNING: DIRECT_URL secret not found${NC}"
  echo -e "   Needed for Prisma migrations"
  HAS_WARNINGS=1
else
  echo -e "${GREEN}✓${NC} DIRECT_URL secret exists (digest: ${DIRECT_URL_DIGEST:0:8}...)"
  echo -e "   Should use: port 5432 (direct connection)"
fi

echo ""

# Check app health
echo -e "${BLUE}🏥 Checking application health...${NC}"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "https://${APP_NAME}.fly.dev/api/health" || echo "000")

if [ "$HEALTH_CHECK" == "200" ]; then
  echo -e "${GREEN}✓${NC} Application is responding (HTTP 200)"
else
  echo -e "${YELLOW}⚠️  WARNING: Application health check returned: $HEALTH_CHECK${NC}"
  HAS_WARNINGS=1
fi

# Check database health
echo -e "${BLUE}🗄️  Checking database connection...${NC}"
DB_HEALTH=$(curl -s "https://${APP_NAME}.fly.dev/api/health/database" || echo '{"success":false}')
DB_STATUS=$(echo "$DB_HEALTH" | jq -r '.data.status' 2>/dev/null || echo "unknown")

if [ "$DB_STATUS" == "connected" ]; then
  DB_LATENCY=$(echo "$DB_HEALTH" | jq -r '.data.latency')
  echo -e "${GREEN}✓${NC} Database connected (latency: $DB_LATENCY)"
else
  echo -e "${RED}❌ ERROR: Database not connected (status: $DB_STATUS)${NC}"
  HAS_ERRORS=1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Summary
if [ $HAS_ERRORS -eq 1 ]; then
  echo -e "${RED}❌ Production configuration has ERRORS${NC}"
  echo ""
  echo -e "${YELLOW}Fix Commands:${NC}"
  echo -e "${BLUE}# Update DATABASE_URL:${NC}"
  echo "flyctl secrets set DATABASE_URL='postgresql://postgres.PROJECT:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1' -a $APP_NAME"
  echo ""
  echo -e "${BLUE}# Update DIRECT_URL:${NC}"
  echo "flyctl secrets set DIRECT_URL='postgresql://postgres.PROJECT:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres' -a $APP_NAME"
  echo ""
  echo -e "${BLUE}# Check logs:${NC}"
  echo "flyctl logs -a $APP_NAME"
  echo ""
  exit 1
elif [ $HAS_WARNINGS -eq 1 ]; then
  echo -e "${YELLOW}⚠️  Production configuration has WARNINGS${NC}"
  echo ""
  echo -e "Review the warnings above and address if needed."
  echo ""
  exit 2
else
  echo -e "${GREEN}✅ Production configuration is valid${NC}"
  echo ""
  echo -e "${BLUE}Quick Commands:${NC}"
  echo -e "  flyctl logs -a $APP_NAME        # View logs"
  echo -e "  flyctl ssh console -a $APP_NAME # SSH into machine"
  echo -e "  flyctl status -a $APP_NAME      # Check status"
  echo ""
  exit 0
fi
