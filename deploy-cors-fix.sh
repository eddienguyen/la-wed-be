#!/bin/bash

###############################################################################
# Deploy Backend with CORS Proxy Fix
# 
# This script deploys the backend with the new image proxy endpoint
# to fix mobile sharing CORS issues.
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        Backend Deployment - CORS Proxy Fix                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: package.json not found${NC}"
  echo -e "${YELLOW}Please run this script from the backend directory:${NC}"
  echo -e "  cd backend"
  echo -e "  ./deploy-cors-fix.sh"
  exit 1
fi

# Check for Fly.io CLI
if ! command -v fly &> /dev/null; then
  echo -e "${RED}❌ Error: Fly.io CLI not found${NC}"
  echo -e "${YELLOW}Please install Fly.io CLI:${NC}"
  echo -e "  curl -L https://fly.io/install.sh | sh"
  exit 1
fi

echo -e "${BLUE}📋 Pre-deployment checklist:${NC}"
echo ""
echo "  ✅ Backend proxy endpoint created (routes/proxy.js)"
echo "  ✅ Proxy route registered in app.js"
echo "  ✅ Frontend auto-fallback implemented"
echo ""

# Show changes
echo -e "${BLUE}📦 Files included in this deployment:${NC}"
echo ""
echo "  NEW: src/routes/proxy.js"
echo "  MOD: src/app.js"
echo ""

# Confirm deployment
read -p "$(echo -e ${YELLOW}Deploy to Fly.io? [y/N]:${NC} )" -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}⏸️  Deployment cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}🚀 Deploying to Fly.io...${NC}"
echo ""

# Deploy
if fly deploy; then
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                  ✅ Deployment Successful!                     ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}📍 Backend URL:${NC} https://ngocquan-wedding-api.fly.dev"
  echo -e "${BLUE}🔍 Proxy Endpoint:${NC} https://ngocquan-wedding-api.fly.dev/api/proxy-image"
  echo ""
  echo -e "${BLUE}🧪 Test Commands:${NC}"
  echo ""
  echo "  # Check health"
  echo "  curl https://ngocquan-wedding-api.fly.dev/api/health"
  echo ""
  echo "  # Test proxy (replace with actual image URL)"
  echo "  curl \"https://ngocquan-wedding-api.fly.dev/api/proxy-image?url=https%3A%2F%2Fpub-21ea89e4ac284364a9ca997dff136166.r2.dev%2Finvitations%2Fhanoi%2F2025%2F10%2F28%2Ftest-front.jpg\""
  echo ""
  echo -e "${GREEN}📱 Next Steps:${NC}"
  echo ""
  echo "  1. Test mobile sharing on your phone"
  echo "  2. Check browser console for logs:"
  echo "     - ✅ Proxy working: \"Successfully fetched image via proxy\""
  echo "     - ⚠️  CORS needed: Fix R2 CORS for better performance"
  echo ""
  echo "  3. Optional: Fix R2 CORS for optimal performance"
  echo "     See: docs/STORY-73-R2-CORS-FIX-SHARING.md"
  echo ""
  echo -e "${BLUE}📊 View Logs:${NC}"
  echo "  fly logs"
  echo ""
else
  echo ""
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                    ❌ Deployment Failed                        ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}💡 Troubleshooting:${NC}"
  echo ""
  echo "  1. Check Fly.io authentication:"
  echo "     fly auth login"
  echo ""
  echo "  2. Verify fly.toml configuration"
  echo ""
  echo "  3. Check deployment logs:"
  echo "     fly logs"
  echo ""
  exit 1
fi
