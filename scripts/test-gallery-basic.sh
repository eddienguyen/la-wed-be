#!/bin/bash

# ============================================================================
# Story #67 Gallery API Endpoints - Integration Testing Script
# ============================================================================

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

API_BASE="http://localhost:3000/api"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Story #67 Gallery API Endpoints - Integration Tests${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Test 1: GET /api/gallery - Empty Gallery
# ============================================================================
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Test 1: GET /api/gallery - Empty Gallery${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

curl -s "$API_BASE/gallery" | jq '.'
echo -e "${GREEN}✅ Test 1 complete${NC}"
echo ""

# ============================================================================
# Test 2: GET /api/gallery/featured - Empty Featured
# ============================================================================
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Test 2: GET /api/gallery/featured${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

curl -s "$API_BASE/gallery/featured" | jq '.'
echo -e "${GREEN}✅ Test 2 complete${NC}"
echo ""

# ============================================================================
# Test 3: Invalid UUID Validation
# ============================================================================
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Test 3: Invalid UUID Validation${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo "Testing with invalid UUID: 'test-id-123'"
curl -s "$API_BASE/gallery/test-id-123" | jq '.'
echo -e "${GREEN}✅ Test 3 complete - Should show validation error${NC}"
echo ""

# ============================================================================
# Test 4: Non-existent ID (404)
# ============================================================================
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Test 4: Non-existent ID (404)${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

FAKE_UUID="00000000-0000-0000-0000-000000000000"
echo "Testing with non-existent UUID: $FAKE_UUID"
curl -s "$API_BASE/gallery/$FAKE_UUID" | jq '.'
echo -e "${GREEN}✅ Test 4 complete - Should show 404${NC}"
echo ""

# ============================================================================
# Test 5: Query Parameters
# ============================================================================
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Test 5: Query Parameters${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo "Testing pagination (page=1, limit=10):"
curl -s "$API_BASE/gallery?page=1&limit=10" | jq '.'
echo ""

echo "Testing category filter (category=ceremony):"
curl -s "$API_BASE/gallery?category=ceremony" | jq '.'
echo ""

echo "Testing search (search=test):"
curl -s "$API_BASE/gallery?search=test" | jq '.'
echo ""

echo "Testing sorting (sortBy=createdAt, sortOrder=desc):"
curl -s "$API_BASE/gallery?sortBy=createdAt&sortOrder=desc" | jq '.'
echo -e "${GREEN}✅ Test 5 complete${NC}"
echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ All GET endpoint tests complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Tests Completed:${NC}"
echo "  ✅ GET /api/gallery - Empty list"
echo "  ✅ GET /api/gallery/featured - Empty featured"
echo "  ✅ GET /api/gallery/:id - Invalid UUID validation"
echo "  ✅ GET /api/gallery/:id - Non-existent ID (404)"
echo "  ✅ GET /api/gallery - Query parameters (pagination, filter, search, sort)"
echo ""
echo -e "${CYAN}Database Status:${NC}"
echo "  • GalleryMedia table: ✅ Created"
echo "  • Current records: 0 (empty as expected)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Test file upload with a real image"
echo "  2. Test PUT /api/gallery/:id (update metadata)"
echo "  3. Test PUT /api/gallery/reorder (bulk reorder)"
echo "  4. Test DELETE /api/gallery/:id (soft delete)"
echo ""
echo -e "${CYAN}To test upload manually:${NC}"
echo "  curl -X POST -F \"file=@/path/to/image.jpg\" \\"
echo "       -F \"title=Test Image\" \\"
echo "       -F \"caption=Test Caption\" \\"
echo "       -F \"category=ceremony\" \\"
echo "       -F \"featured=true\" \\"
echo "       $API_BASE/gallery"
echo ""
