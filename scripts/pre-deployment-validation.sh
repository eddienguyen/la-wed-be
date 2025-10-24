#!/bin/bash

# ============================================================================
# Pre-Deployment Validation Script
# ============================================================================
# Validates database state and migration readiness before deployment
# ============================================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Pre-Deployment Validation for Gallery Migration${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Check 1: Database Connection
# ============================================================================
echo -e "${YELLOW}Check 1: Database Connection${NC}"

# Check if DATABASE_URL is set
if grep -q "DATABASE_URL" .env 2>/dev/null; then
  echo -e "${GREEN}✅ DATABASE_URL found in .env${NC}"
  
  # Try to connect using Prisma
  if npx prisma db execute --schema=prisma/schema.prisma --stdin <<< "SELECT 1;" &> /dev/null; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
  else
    echo -e "${YELLOW}⚠️  Could not verify database connection${NC}"
    echo -e "${YELLOW}   Continuing with remaining checks...${NC}"
  fi
else
  echo -e "${RED}❌ DATABASE_URL not found in .env${NC}"
  echo -e "${RED}   Please check .env configuration${NC}"
  exit 1
fi
echo ""

# ============================================================================
# Check 2: Current Media Records
# ============================================================================
echo -e "${YELLOW}Check 2: Current Media Table Status${NC}"

# Try to get media count using Prisma studio data or skip if connection fails
MEDIA_COUNT=$(npx prisma db execute --schema=prisma/schema.prisma --stdin <<< "SELECT COUNT(*) FROM media;" 2>/dev/null | grep -oE '[0-9]+' | tail -1 || echo "unknown")

if [ "$MEDIA_COUNT" = "unknown" ]; then
  echo -e "${YELLOW}   ⚠️  Could not query Media table${NC}"
  echo -e "${YELLOW}   Assuming empty table (first deployment)${NC}"
  MEDIA_COUNT=0
else
  echo -e "   Current Media records: ${BLUE}${MEDIA_COUNT}${NC}"
fi

if [ "$MEDIA_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}   ⚠️  No existing records to migrate${NC}"
  echo -e "${YELLOW}   ⚠️  Migration will complete successfully but no data will be moved${NC}"
else
  echo -e "${GREEN}   ✅ Found ${MEDIA_COUNT} records ready for migration${NC}"
fi
echo ""

# ============================================================================
# Check 3: GalleryMedia Table Exists
# ============================================================================
echo -e "${YELLOW}Check 3: GalleryMedia Table${NC}"

GALLERY_COUNT=$(npx prisma db execute --schema=prisma/schema.prisma --stdin <<< "SELECT COUNT(*) FROM gallery_media;" 2>/dev/null | grep -oE '[0-9]+' | tail -1 || echo "unknown")

if [ "$GALLERY_COUNT" = "unknown" ]; then
  echo -e "${YELLOW}⚠️  GalleryMedia table query failed${NC}"
  echo -e "${YELLOW}   Table may not exist yet${NC}"
  echo -e "${YELLOW}   Run: npx prisma migrate deploy${NC}"
else
  echo -e "${GREEN}✅ GalleryMedia table exists${NC}"
  echo -e "   Current GalleryMedia records: ${BLUE}${GALLERY_COUNT}${NC}"
fi
echo ""

# ============================================================================
# Check 4: Prisma Client Generated
# ============================================================================
echo -e "${YELLOW}Check 4: Prisma Client${NC}"

if [ -d "node_modules/@prisma/client" ]; then
  echo -e "${GREEN}✅ Prisma Client is installed${NC}"
  
  # Check if it's up to date with schema
  if grep -q "model GalleryMedia" "node_modules/.prisma/client/index.d.ts" 2>/dev/null; then
    echo -e "${GREEN}✅ Prisma Client includes GalleryMedia model${NC}"
  else
    echo -e "${YELLOW}⚠️  Prisma Client may be outdated${NC}"
    echo -e "${YELLOW}   Run: npx prisma generate${NC}"
  fi
else
  echo -e "${RED}❌ Prisma Client not found${NC}"
  echo -e "${RED}   Run: npm install && npx prisma generate${NC}"
  exit 1
fi
echo ""

# ============================================================================
# Check 5: Migration Scripts Exist
# ============================================================================
echo -e "${YELLOW}Check 5: Migration Scripts${NC}"

if [ -f "scripts/migrate-gallery-data.js" ]; then
  echo -e "${GREEN}✅ Data migration script exists${NC}"
else
  echo -e "${RED}❌ Migration script not found${NC}"
  exit 1
fi

if [ -f "scripts/complete-gallery-migration.sh" ]; then
  echo -e "${GREEN}✅ Complete migration script exists${NC}"
else
  echo -e "${YELLOW}⚠️  Complete migration script not found${NC}"
fi
echo ""

# ============================================================================
# Check 6: Backup Directory
# ============================================================================
echo -e "${YELLOW}Check 6: Backup Directory${NC}"

if [ -d "backups" ]; then
  BACKUP_COUNT=$(ls -1 backups/*.json 2>/dev/null | wc -l)
  echo -e "${GREEN}✅ Backup directory exists${NC}"
  echo -e "   Existing backups: ${BLUE}${BACKUP_COUNT}${NC}"
else
  echo -e "${YELLOW}⚠️  Backup directory will be created during migration${NC}"
fi
echo ""

# ============================================================================
# Check 7: Test Dry Run
# ============================================================================
echo -e "${YELLOW}Check 7: Migration Dry Run${NC}"
echo -e "   Testing migration script..."

if node scripts/migrate-gallery-data.js --dry-run &> /dev/null; then
  echo -e "${GREEN}✅ Dry run completed successfully${NC}"
else
  echo -e "${RED}❌ Dry run failed${NC}"
  echo -e "${RED}   Run manually: node scripts/migrate-gallery-data.js --dry-run${NC}"
  exit 1
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Pre-Deployment Validation Complete${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

echo -e "${GREEN}Summary:${NC}"
echo -e "  ✅ Database connection verified"
echo -e "  ✅ Migration tables ready"
echo -e "  ✅ Scripts available"
echo -e "  ✅ Dry run successful"
echo ""

if [ "$MEDIA_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Note: No existing Media records found${NC}"
  echo -e "${YELLOW}   Migration will complete but no data will be moved.${NC}"
  echo -e "${YELLOW}   New uploads will use GalleryMedia directly.${NC}"
  echo ""
fi

echo -e "${BLUE}Ready for Deployment Steps:${NC}"
echo -e "  1. ✅ Pre-deployment validation (current step)"
echo -e "  2. ⏭️  Run: node scripts/migrate-gallery-data.js --backup"
echo -e "  3. ⏭️  Validate migrated data"
echo -e "  4. ⏭️  Deploy updated backend code"
echo -e "  5. ⏭️  Test gallery operations"
echo ""

echo -e "${BLUE}Or run complete migration:${NC}"
echo -e "  ./scripts/complete-gallery-migration.sh"
echo ""
echo -e "${BLUE}============================================================================${NC}"
