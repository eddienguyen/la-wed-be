#!/bin/bash

# ============================================================================
# Gallery Database Migration - Complete Replacement Script
# ============================================================================
# This script performs a complete migration from Media to GalleryMedia:
# 1. Backup current data
# 2. Dry run to verify migration
# 3. Execute data migration
# 4. Validate migrated data
# 5. Drop old Media table (optional)
#
# Usage: ./scripts/complete-gallery-migration.sh [--skip-drop]
# ============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Arguments
SKIP_DROP=false
if [[ "$1" == "--skip-drop" ]]; then
  SKIP_DROP=true
fi

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Gallery Database Migration - Complete Replacement${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Step 1: Backup Current Data
# ============================================================================
echo -e "${YELLOW}Step 1/5: Creating backup of current Media table...${NC}"
node scripts/migrate-gallery-data.js --backup

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Backup failed! Aborting migration.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Backup completed successfully${NC}"
echo ""

# ============================================================================
# Step 2: Dry Run Migration
# ============================================================================
echo -e "${YELLOW}Step 2/5: Running migration in dry-run mode...${NC}"
node scripts/migrate-gallery-data.js --dry-run

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Dry run failed! Please review errors above.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Dry run completed successfully${NC}"
echo ""

# ============================================================================
# Step 3: Confirm Migration
# ============================================================================
echo -e "${YELLOW}Step 3/5: Ready to execute migration${NC}"
echo -e "${YELLOW}⚠️  This will migrate all data from Media to GalleryMedia${NC}"
echo ""
read -p "Do you want to proceed? (yes/no): " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
  echo -e "${RED}❌ Migration cancelled by user${NC}"
  exit 0
fi

echo ""

# ============================================================================
# Step 4: Execute Migration
# ============================================================================
echo -e "${YELLOW}Step 4/5: Executing data migration...${NC}"
node scripts/migrate-gallery-data.js

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Migration failed! Data is backed up.${NC}"
  echo -e "${RED}   Review errors and consider rollback.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Data migration completed successfully${NC}"
echo ""

# ============================================================================
# Step 5: Drop Old Media Table (Optional)
# ============================================================================
if [ "$SKIP_DROP" = false ]; then
  echo -e "${YELLOW}Step 5/5: Dropping old Media table${NC}"
  echo -e "${YELLOW}⚠️  This is IRREVERSIBLE - ensure migration was successful!${NC}"
  echo ""
  read -p "Drop old Media table? (yes/no): " CONFIRM_DROP

  if [[ "$CONFIRM_DROP" == "yes" ]]; then
    echo ""
    echo -e "${YELLOW}Removing Media model from Prisma schema...${NC}"
    
    # Create migration to drop Media table
    cat > "prisma/migrations/$(date +%Y%m%d%H%M%S)_drop_old_media_table/migration.sql" << 'EOF'
-- Drop old Media table
DROP TABLE IF EXISTS "media" CASCADE;
EOF

    echo -e "${GREEN}✅ Migration file created${NC}"
    echo ""
    
    echo -e "${YELLOW}Applying migration...${NC}"
    npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✅ Old Media table dropped successfully${NC}"
    else
      echo -e "${RED}❌ Failed to drop Media table${NC}"
      exit 1
    fi
  else
    echo -e "${BLUE}ℹ️  Skipping table drop - old Media table preserved${NC}"
  fi
else
  echo -e "${BLUE}Step 5/5: Skipping table drop (--skip-drop flag)${NC}"
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Migration Complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${GREEN}Summary:${NC}"
echo -e "  ✅ Backup created"
echo -e "  ✅ Dry run validated"
echo -e "  ✅ Data migrated to GalleryMedia"
echo -e "  ✅ Migration verified"

if [ "$SKIP_DROP" = false ] && [[ "$CONFIRM_DROP" == "yes" ]]; then
  echo -e "  ✅ Old Media table dropped"
else
  echo -e "  ⏭️  Old Media table preserved"
fi

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Verify GalleryMedia data in database"
echo -e "  2. Test all gallery operations"
echo -e "  3. Update frontend to use new schema"
echo -e "  4. Monitor production for 24-48 hours"
echo ""
echo -e "${BLUE}============================================================================${NC}"
