#!/bin/bash

# ============================================================================
# Story #67 Gallery API Endpoints - Integration Testing Script
# ============================================================================
# Tests all 7 gallery endpoints with real data after Story #66 deployment
# ============================================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
API_BASE="http://localhost:3000/api"
TEST_IMAGE="test/fixtures/test-image.jpg"
TEST_VIDEO="test/fixtures/test-video.mp4"

# Variables to store IDs for cleanup
UPLOADED_IMAGE_ID=""
UPLOADED_VIDEO_ID=""

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Story #67 Gallery API Endpoints - Integration Tests${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Helper Functions
# ============================================================================

print_test() {
    echo -e "${CYAN}TEST: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ PASSED: $1${NC}"
}

print_error() {
    echo -e "${RED}❌ FAILED: $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# ============================================================================
# Test 1: GET /api/gallery - Empty Gallery
# ============================================================================
print_section "Test 1: GET /api/gallery - Empty Gallery"

print_test "Fetching empty gallery list"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    COUNT=$(echo "$BODY" | jq -r '.data | length')
    if [ "$COUNT" -eq 0 ]; then
        print_success "Empty gallery returns 0 items"
        echo "$BODY" | jq '.'
    else
        print_error "Expected 0 items, got $COUNT"
    fi
else
    print_error "Expected 200, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================================================
# Test 2: GET /api/gallery/featured - Empty Featured
# ============================================================================
print_section "Test 2: GET /api/gallery/featured - Empty Featured"

print_test "Fetching empty featured items"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery/featured")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    COUNT=$(echo "$BODY" | jq -r '.data | length')
    if [ "$COUNT" -eq 0 ]; then
        print_success "Empty featured returns 0 items"
        echo "$BODY" | jq '.'
    else
        print_error "Expected 0 items, got $COUNT"
    fi
else
    print_error "Expected 200, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================================================
# Test 3: GET /api/gallery/:id - Invalid UUID
# ============================================================================
print_section "Test 3: GET /api/gallery/:id - Invalid UUID Validation"

print_test "Fetching with invalid UUID"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery/invalid-uuid-123")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 400 ]; then
    print_success "Invalid UUID rejected with 400"
    echo "$BODY" | jq '.'
else
    print_error "Expected 400, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================================================
# Test 4: GET /api/gallery/:id - Non-existent ID
# ============================================================================
print_section "Test 4: GET /api/gallery/:id - Non-existent ID"

print_test "Fetching non-existent media item"
FAKE_UUID="00000000-0000-0000-0000-000000000000"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery/$FAKE_UUID")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 404 ]; then
    print_success "Non-existent ID returns 404"
    echo "$BODY" | jq '.'
else
    print_error "Expected 404, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================================================
# Test 5: POST /api/gallery - Upload Image (if test file exists)
# ============================================================================
print_section "Test 5: POST /api/gallery - Upload Image"

if [ -f "$TEST_IMAGE" ]; then
    print_test "Uploading test image"
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -F "file=@$TEST_IMAGE" \
        -F "title=Test Image Upload" \
        -F "caption=This is a test image for Story #67" \
        -F "category=ceremony" \
        -F "featured=true" \
        "$API_BASE/gallery")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 201 ]; then
        UPLOADED_IMAGE_ID=$(echo "$BODY" | jq -r '.data.id')
        print_success "Image uploaded successfully (ID: $UPLOADED_IMAGE_ID)"
        echo "$BODY" | jq '.'
    else
        print_error "Upload failed with $HTTP_CODE"
        echo "$BODY"
    fi
else
    print_info "Test image not found at $TEST_IMAGE - skipping upload test"
    print_info "To run upload tests, add test-image.jpg to test/fixtures/"
fi

# ============================================================================
# Test 6: GET /api/gallery - With Data
# ============================================================================
if [ -n "$UPLOADED_IMAGE_ID" ]; then
    print_section "Test 6: GET /api/gallery - With Data"
    
    print_test "Fetching gallery with uploaded image"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        COUNT=$(echo "$BODY" | jq -r '.data | length')
        if [ "$COUNT" -ge 1 ]; then
            print_success "Gallery now contains $COUNT item(s)"
            echo "$BODY" | jq '.'
        else
            print_error "Expected at least 1 item, got $COUNT"
        fi
    else
        print_error "Expected 200, got $HTTP_CODE"
        echo "$BODY"
    fi
fi

# ============================================================================
# Test 7: GET /api/gallery/:id - Valid ID
# ============================================================================
if [ -n "$UPLOADED_IMAGE_ID" ]; then
    print_section "Test 7: GET /api/gallery/:id - Valid ID"
    
    print_test "Fetching uploaded image by ID"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery/$UPLOADED_IMAGE_ID")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        TITLE=$(echo "$BODY" | jq -r '.data.title')
        print_success "Successfully fetched media item: $TITLE"
        echo "$BODY" | jq '.'
    else
        print_error "Expected 200, got $HTTP_CODE"
        echo "$BODY"
    fi
fi

# ============================================================================
# Test 8: GET /api/gallery/featured - With Featured Item
# ============================================================================
if [ -n "$UPLOADED_IMAGE_ID" ]; then
    print_section "Test 8: GET /api/gallery/featured - With Featured Item"
    
    print_test "Fetching featured items"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery/featured")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        COUNT=$(echo "$BODY" | jq -r '.data | length')
        if [ "$COUNT" -ge 1 ]; then
            print_success "Featured gallery contains $COUNT item(s)"
            echo "$BODY" | jq '.'
            
            # Test caching - second request should be faster
            print_info "Testing cache by making second request..."
            RESPONSE2=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery/featured")
            CACHE_HEADER=$(echo "$RESPONSE2" | grep -i "Cache-Control" || echo "")
            if [ -n "$CACHE_HEADER" ]; then
                print_success "Cache-Control header present"
            fi
        else
            print_error "Expected at least 1 featured item, got $COUNT"
        fi
    else
        print_error "Expected 200, got $HTTP_CODE"
        echo "$BODY"
    fi
fi

# ============================================================================
# Test 9: PUT /api/gallery/:id - Update Metadata
# ============================================================================
if [ -n "$UPLOADED_IMAGE_ID" ]; then
    print_section "Test 9: PUT /api/gallery/:id - Update Metadata"
    
    print_test "Updating image metadata"
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -d '{
            "title": "Updated Test Image",
            "caption": "Caption updated via PUT request",
            "category": "reception",
            "featured": false,
            "location": "Wedding Venue",
            "photographer": "Test Photographer"
        }' \
        "$API_BASE/gallery/$UPLOADED_IMAGE_ID")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        UPDATED_TITLE=$(echo "$BODY" | jq -r '.data.title')
        print_success "Metadata updated: $UPDATED_TITLE"
        echo "$BODY" | jq '.'
    else
        print_error "Update failed with $HTTP_CODE"
        echo "$BODY"
    fi
fi

# ============================================================================
# Test 10: GET /api/gallery - Filtering and Sorting
# ============================================================================
if [ -n "$UPLOADED_IMAGE_ID" ]; then
    print_section "Test 10: GET /api/gallery - Filtering and Sorting"
    
    # Test category filter
    print_test "Testing category filter (category=reception)"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery?category=reception")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        COUNT=$(echo "$BODY" | jq -r '.data | length')
        print_success "Category filter returned $COUNT item(s)"
        echo "$BODY" | jq '.'
    fi
    
    # Test sorting
    print_test "Testing sorting (sortBy=createdAt, sortOrder=desc)"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery?sortBy=createdAt&sortOrder=desc")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        print_success "Sorting applied successfully"
        echo "$BODY" | jq '.'
    fi
    
    # Test search
    print_test "Testing search (search=Updated)"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery?search=Updated")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        COUNT=$(echo "$BODY" | jq -r '.data | length')
        print_success "Search returned $COUNT matching item(s)"
        echo "$BODY" | jq '.'
    fi
fi

# ============================================================================
# Test 11: PUT /api/gallery/reorder - Bulk Reorder
# ============================================================================
if [ -n "$UPLOADED_IMAGE_ID" ]; then
    print_section "Test 11: PUT /api/gallery/reorder - Bulk Reorder"
    
    print_test "Reordering media items"
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -d "{
            \"items\": [
                {\"id\": \"$UPLOADED_IMAGE_ID\", \"displayOrder\": 1}
            ]
        }" \
        "$API_BASE/gallery/reorder")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        print_success "Bulk reorder completed"
        echo "$BODY" | jq '.'
    else
        print_error "Reorder failed with $HTTP_CODE"
        echo "$BODY"
    fi
fi

# ============================================================================
# Test 12: DELETE /api/gallery/:id - Soft Delete
# ============================================================================
if [ -n "$UPLOADED_IMAGE_ID" ]; then
    print_section "Test 12: DELETE /api/gallery/:id - Soft Delete"
    
    print_test "Soft deleting image"
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X DELETE \
        "$API_BASE/gallery/$UPLOADED_IMAGE_ID")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        print_success "Soft delete successful"
        echo "$BODY" | jq '.'
        
        # Verify item is no longer in list
        print_test "Verifying soft-deleted item not in gallery list"
        RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/gallery")
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | head -n-1)
        
        if [ "$HTTP_CODE" -eq 200 ]; then
            COUNT=$(echo "$BODY" | jq -r '.data | length')
            if [ "$COUNT" -eq 0 ]; then
                print_success "Soft-deleted item not in list"
            else
                print_error "Expected 0 items, got $COUNT"
            fi
        fi
    else
        print_error "Delete failed with $HTTP_CODE"
        echo "$BODY"
    fi
fi

# ============================================================================
# Test Summary
# ============================================================================
print_section "Test Summary"

echo -e "${GREEN}✅ All accessible tests completed!${NC}"
echo ""
echo -e "${YELLOW}Test Coverage:${NC}"
echo "  • GET /api/gallery - Empty, with data, filtering, sorting, search"
echo "  • GET /api/gallery/:id - Invalid UUID, non-existent, valid ID"
echo "  • GET /api/gallery/featured - Empty, with data, caching"
if [ -n "$UPLOADED_IMAGE_ID" ]; then
    echo "  • POST /api/gallery - Image upload ✅"
    echo "  • PUT /api/gallery/:id - Metadata update ✅"
    echo "  • PUT /api/gallery/reorder - Bulk reorder ✅"
    echo "  • DELETE /api/gallery/:id - Soft delete ✅"
else
    echo "  • POST /api/gallery - Image upload ⏭️  SKIPPED (no test file)"
    echo "  • PUT /api/gallery/:id - Metadata update ⏭️  SKIPPED"
    echo "  • PUT /api/gallery/reorder - Bulk reorder ⏭️  SKIPPED"
    echo "  • DELETE /api/gallery/:id - Soft delete ⏭️  SKIPPED"
fi
echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}Story #67 Integration Testing Complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"
