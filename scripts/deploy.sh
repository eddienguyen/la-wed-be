#!/bin/bash
# Deploy backend to Fly.io with build metadata

set -e

echo "🚀 Deploying backend to Fly.io with version tracking..."

# Get git information
GIT_COMMIT=$(git rev-parse --short HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "📝 Build metadata:"
echo "   Git Commit: $GIT_COMMIT"
echo "   Git Branch: $GIT_BRANCH"
echo "   Build Time: $BUILD_TIMESTAMP"
echo ""

# Deploy to Fly.io with build arguments
flyctl deploy \
  --build-arg GIT_COMMIT_HASH="$GIT_COMMIT" \
  --build-arg GIT_BRANCH="$GIT_BRANCH" \
  --build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 Verify deployment:"
echo "   curl https://ngocquan-wedding-api.fly.dev/api/version"
echo ""
echo "Expected output should show:"
echo "   gitCommit: $GIT_COMMIT"
echo "   buildTimestamp: $BUILD_TIMESTAMP"
