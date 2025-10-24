#!/bin/bash

# Gallery Media Integration Tests - Quick Setup
# This script helps set up and run the integration tests

set -e

echo "🎬 Gallery Media Integration Tests Setup"
echo "========================================"
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

# Check for FFmpeg
echo "🔍 Checking for FFmpeg..."
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed!"
    echo ""
    echo "Please install FFmpeg:"
    echo "  macOS:   brew install ffmpeg"
    echo "  Ubuntu:  sudo apt-get install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org/download.html"
    echo ""
    exit 1
else
    FFMPEG_VERSION=$(ffmpeg -version | head -n1)
    echo "✅ FFmpeg found: $FFMPEG_VERSION"
fi

# Check for test fixtures directory
echo ""
echo "📁 Checking test fixtures directory..."
if [ ! -d "test/fixtures" ]; then
    echo "⚠️  Creating test/fixtures directory..."
    mkdir -p test/fixtures
    echo "✅ Directory created"
else
    echo "✅ Directory exists"
fi

# Check for test fixtures
echo ""
echo "📸 Checking for test fixtures..."
MISSING_FIXTURES=0

if [ ! -f "test/fixtures/test-image.jpg" ]; then
    echo "⚠️  Missing: test/fixtures/test-image.jpg"
    MISSING_FIXTURES=1
else
    SIZE=$(du -h test/fixtures/test-image.jpg | cut -f1)
    echo "✅ Found test-image.jpg ($SIZE)"
fi

if [ ! -f "test/fixtures/test-video.mp4" ]; then
    echo "⚠️  Missing: test/fixtures/test-video.mp4"
    MISSING_FIXTURES=1
else
    SIZE=$(du -h test/fixtures/test-video.mp4 | cut -f1)
    echo "✅ Found test-video.mp4 ($SIZE)"
fi

# Provide guidance for missing fixtures
if [ $MISSING_FIXTURES -eq 1 ]; then
    echo ""
    echo "📝 To add test fixtures:"
    echo "  cp /path/to/your/image.jpg test/fixtures/test-image.jpg"
    echo "  cp /path/to/your/video.mp4 test/fixtures/test-video.mp4"
    echo ""
    echo "  Requirements:"
    echo "  - test-image.jpg: < 10MB, JPEG format, any resolution"
    echo "  - test-video.mp4: < 100MB, MP4 format, 5-30 seconds"
    echo ""
    echo "⚠️  Some tests will be skipped without fixtures"
fi

# Check environment variables
echo ""
echo "⚙️  Checking environment variables..."
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found"
    echo "  Copy .env.example and configure R2 credentials"
else
    if grep -q "R2_ACCOUNT_ID" .env && grep -q "R2_BUCKET_NAME" .env; then
        echo "✅ R2 environment variables configured"
    else
        echo "⚠️  R2 environment variables not configured"
        echo "  Please add R2 credentials to .env:"
        echo "    R2_ACCOUNT_ID"
        echo "    R2_ACCESS_KEY_ID"
        echo "    R2_SECRET_ACCESS_KEY"
        echo "    R2_BUCKET_NAME"
    fi
fi

# Ready to run tests
echo ""
echo "========================================"
echo "✅ Setup complete!"
echo ""
echo "To run tests:"
echo "  npm test gallery-media-integration.test.js"
echo ""
echo "To run specific test suites:"
echo "  npm test gallery-media-integration.test.js -- -t 'Image Upload Pipeline'"
echo "  npm test gallery-media-integration.test.js -- -t 'Video Upload Pipeline'"
echo ""
echo "For more information:"
echo "  cat test/GALLERY-INTEGRATION-TESTS.md"
echo ""
