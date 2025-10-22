#!/bin/bash

##############################################################################
# Database Configuration Validator
#
# Validates that DATABASE_URL and DIRECT_URL are properly configured
# for Supabase pooler connections to prevent P1001 errors.
#
# Usage:
#   bash scripts/validate-db-config.sh
#
# Exit codes:
#   0 - Configuration is valid
#   1 - Configuration has errors
#   2 - Configuration has warnings
##############################################################################

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Validating Database Configuration...${NC}\n"

# Load .env file
if [ ! -f .env ]; then
  echo -e "${RED}❌ ERROR: .env file not found${NC}"
  exit 1
fi

# Parse .env file properly (handles URLs with special characters)
export $(grep -v '^#' .env | grep -v '^$' | xargs)

HAS_ERRORS=0
HAS_WARNINGS=0

# Validate DATABASE_URL exists
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ ERROR: DATABASE_URL is not set${NC}"
  HAS_ERRORS=1
else
  echo -e "${GREEN}✓${NC} DATABASE_URL is set"
  
  # Check if using Supabase
  if [[ $DATABASE_URL == *"supabase.com"* ]]; then
    echo -e "${BLUE}  Detected Supabase database${NC}"
    
    # Check if using pooler domain
    if [[ $DATABASE_URL != *".pooler.supabase.com"* ]]; then
      echo -e "${YELLOW}⚠️  WARNING: Not using .pooler.supabase.com domain${NC}"
      echo -e "   For better stability, use the pooler domain"
      HAS_WARNINGS=1
    else
      echo -e "${GREEN}  ✓${NC} Using pooler domain"
    fi
    
    # Check port
    if [[ $DATABASE_URL == *":5432/"* ]]; then
      if [[ $DATABASE_URL != *"pgbouncer=true"* ]]; then
        echo -e "${RED}❌ ERROR: Using port 5432 without pgbouncer=true${NC}"
        echo -e "   This will cause 'Can't reach database server' errors"
        echo -e "   ${YELLOW}FIX: Use port 6543 with pgbouncer=true${NC}"
        echo -e "   Example: postgresql://user:pass@host.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
        HAS_ERRORS=1
      fi
    elif [[ $DATABASE_URL == *":6543/"* ]]; then
      echo -e "${GREEN}  ✓${NC} Using pooler port 6543"
      
      # Check for pgbouncer parameter
      if [[ $DATABASE_URL != *"pgbouncer=true"* ]]; then
        echo -e "${YELLOW}⚠️  WARNING: Missing pgbouncer=true parameter${NC}"
        echo -e "   Add ?pgbouncer=true to prevent prepared statement errors"
        HAS_WARNINGS=1
      else
        echo -e "${GREEN}  ✓${NC} pgbouncer=true parameter present"
      fi
      
      # Check for connection_limit
      if [[ $DATABASE_URL != *"connection_limit="* ]]; then
        echo -e "${YELLOW}⚠️  WARNING: Missing connection_limit parameter${NC}"
        echo -e "   Recommend: &connection_limit=1 to prevent connection exhaustion"
        HAS_WARNINGS=1
      else
        echo -e "${GREEN}  ✓${NC} connection_limit parameter present"
      fi
    else
      echo -e "${YELLOW}⚠️  WARNING: Non-standard port detected${NC}"
      HAS_WARNINGS=1
    fi
  fi
fi

echo ""

# Validate DIRECT_URL
if [ -z "$DIRECT_URL" ]; then
  echo -e "${YELLOW}⚠️  WARNING: DIRECT_URL is not set${NC}"
  echo -e "   DIRECT_URL is needed for running Prisma migrations"
  echo -e "   It should use port 5432 (direct connection)"
  HAS_WARNINGS=1
else
  echo -e "${GREEN}✓${NC} DIRECT_URL is set"
  
  # DIRECT_URL should use port 5432
  if [[ $DIRECT_URL == *":5432/"* ]]; then
    echo -e "${GREEN}  ✓${NC} Using port 5432 (correct for migrations)"
  else
    echo -e "${YELLOW}⚠️  WARNING: DIRECT_URL should use port 5432 for migrations${NC}"
    HAS_WARNINGS=1
  fi
  
  # DIRECT_URL should NOT have pgbouncer
  if [[ $DIRECT_URL == *"pgbouncer=true"* ]]; then
    echo -e "${YELLOW}⚠️  WARNING: DIRECT_URL should not use pgbouncer${NC}"
    echo -e "   Direct connections don't need connection pooling"
    HAS_WARNINGS=1
  fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Summary
if [ $HAS_ERRORS -eq 1 ]; then
  echo -e "${RED}❌ Configuration has ERRORS - must be fixed${NC}"
  echo ""
  echo -e "${YELLOW}Quick Fix Command:${NC}"
  echo -e "${BLUE}# Update DATABASE_URL to use pooler:${NC}"
  echo "DATABASE_URL='postgresql://USER:PASS@HOST.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'"
  echo ""
  exit 1
elif [ $HAS_WARNINGS -eq 1 ]; then
  echo -e "${YELLOW}⚠️  Configuration has WARNINGS - should be addressed${NC}"
  exit 2
else
  echo -e "${GREEN}✅ Configuration is valid${NC}"
  exit 0
fi
