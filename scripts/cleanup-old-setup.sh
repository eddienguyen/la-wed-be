#!/bin/bash

##############################################################################
# Post-Migration Cleanup Script
#
# This script should be run ONLY AFTER successful migration to Fly.io
# and at least 1 week of stable operation.
#
# It removes Render.com/Supabase specific files that are no longer needed.
#
# Usage:
#   ./scripts/cleanup-old-setup.sh
#
##############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header "Post-Migration Cleanup Script"

print_warning "This script removes Render.com and Supabase specific files"
print_warning "Run this ONLY after successful Fly.io migration and 1 week of stable operation"
echo ""

# Confirmation
read -p "Have you completed migration and monitored for at least 1 week? (yes/no) " -r
echo
if [[ ! $REPLY == "yes" ]]; then
    print_error "Cleanup cancelled. Complete migration and monitoring first."
    exit 1
fi

print_info "This will remove the following files:"
echo "  - render.yaml (Render.com configuration)"
echo ""

read -p "Are you sure you want to proceed? (yes/no) " -r
echo
if [[ ! $REPLY == "yes" ]]; then
    print_error "Cleanup cancelled"
    exit 1
fi

print_header "Removing Old Configuration Files"

# Remove render.yaml
if [ -f "render.yaml" ]; then
    git rm render.yaml
    print_success "Removed render.yaml"
else
    print_info "render.yaml not found (may already be removed)"
fi

print_header "Creating Cleanup Commit"

# Check if there are changes to commit
if git diff --cached --quiet; then
    print_info "No changes to commit (files may already be removed)"
else
    git commit -m "chore: remove Render.com configuration after migration to Fly.io

- Removed render.yaml
- Migration to Fly.io completed and verified
- Old setup documented in ARCHIVE-SUPABASE-RENDER-SETUP.md"
    
    print_success "Changes committed"
    
    # Ask to push
    read -p "Push changes to remote? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push
        print_success "Changes pushed to remote"
    else
        print_info "Changes committed locally but not pushed"
        echo "Run 'git push' when ready to push"
    fi
fi

print_header "Cleanup Complete!"

print_success "Old configuration files removed"
echo ""
print_info "Archive information is still available in:"
echo "  - ARCHIVE-SUPABASE-RENDER-SETUP.md"
echo ""
print_info "To completely remove Fly.io and rollback:"
echo "  1. Follow rollback instructions in ARCHIVE-SUPABASE-RENDER-SETUP.md"
echo "  2. Restore render.yaml from git history"
echo ""

print_success "Migration cleanup completed successfully! 🎉"
