# Gallery Media Integration Tests

Comprehensive integration tests for the Gallery Media Service including image/video upload, variant generation, metadata extraction, and R2 storage operations.

## Test Coverage

### Image Upload Pipeline
- ✅ File validation (size, type)
- ✅ Variant generation (thumbnail, medium, large)
- ✅ EXIF metadata extraction
- ✅ R2 upload with all variants
- ✅ Error handling for invalid/corrupted files

### Video Upload Pipeline
- ✅ File validation (size, type)
- ✅ FFmpeg metadata extraction (duration, resolution, codec, fps)
- ✅ Thumbnail generation at 1-second mark
- ✅ R2 upload (video + thumbnail)
- ✅ Error handling

### Auto-Detection
- ✅ Automatic media type detection
- ✅ Routing to appropriate pipeline

### Batch Operations
- ✅ Multiple file deletion
- ✅ Storage service batch operations

## Required Test Fixtures

The tests require sample media files in the `test/fixtures/` directory:

### test-image.jpg
- **Format**: JPEG
- **Size**: < 10MB
- **Resolution**: 1920x1080 or similar
- **EXIF data**: Optional (camera info, GPS, date)
- **Purpose**: Tests image processing pipeline

### test-video.mp4
- **Format**: MP4 (H.264)
- **Size**: < 100MB
- **Duration**: 5-30 seconds
- **Resolution**: 1280x720 or similar
- **Purpose**: Tests video processing with FFmpeg

## Setup

1. **Create fixtures directory**:
   ```bash
   mkdir -p backend/test/fixtures
   ```

2. **Add test media files**:
   ```bash
   # Copy your test files
   cp /path/to/sample-image.jpg backend/test/fixtures/test-image.jpg
   cp /path/to/sample-video.mp4 backend/test/fixtures/test-video.mp4
   ```

3. **Configure environment**:
   Ensure your `.env` file has valid R2 credentials:
   ```env
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret-key
   R2_BUCKET_NAME=your-bucket-name
   ```

## Running Tests

### All tests
```bash
cd backend
npm test gallery-media-integration.test.js
```

### Specific test suites
```bash
# Image upload tests only
npm test gallery-media-integration.test.js -- -t "Image Upload Pipeline"

# Video upload tests only
npm test gallery-media-integration.test.js -- -t "Video Upload Pipeline"

# Error handling tests only
npm test gallery-media-integration.test.js -- -t "Error Handling"
```

### With coverage
```bash
npm test -- --coverage gallery-media-integration.test.js
```

## Test Warnings

If test fixtures are missing, tests will log warnings and skip:
```
⚠ Test image not found, skipping validation test
⚠ Test video not found, skipping metadata extraction test
```

To run all tests successfully, ensure both fixture files exist.

## Cleanup

The test suite automatically cleans up all uploaded files from R2 after completion using the `afterAll` hook. If tests are interrupted:

```bash
# Manual cleanup script (if needed)
node scripts/cleanup-test-uploads.js
```

## Expected Results

### Successful Test Run
```
✓ should validate image file successfully
✓ should reject oversized image
✓ should generate image variants with correct sizes
✓ should extract image metadata from EXIF
✓ Uploaded image with 4 variants: { original: ..., thumbnail: ..., medium: ..., large: ... }
✓ should validate video file successfully
✓ should reject oversized video
✓ should extract video metadata with FFmpeg
✓ should generate video thumbnail
✓ Uploaded video with thumbnail: { original: ..., thumbnail: ..., duration: 10.5, resolution: 1280x720 }
✓ Cleaned up 10 test files from R2

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Time:        45.231s
```

## Troubleshooting

### FFmpeg not found
```
Error: Cannot find ffmpeg
```
**Solution**: Install FFmpeg on your system:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

### Sharp/libvips errors
```
Error: Could not load the "sharp" module
```
**Solution**: Rebuild Sharp for your platform:
```bash
npm rebuild sharp
```

### R2 connection errors
```
Error: The specified bucket does not exist
```
**Solution**: Verify R2 credentials and bucket name in `.env`

### Timeout errors
```
Error: Timeout of 30000ms exceeded
```
**Solution**: 
- Increase timeout for specific tests (already set to 30-45s)
- Check network connectivity to R2
- Verify FFmpeg is functioning correctly

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Setup FFmpeg
  run: |
    sudo apt-get update
    sudo apt-get install -y ffmpeg

- name: Run Integration Tests
  run: |
    cd backend
    npm test gallery-media-integration.test.js
  env:
    R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
    R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
```

## Performance Benchmarks

Expected execution times:
- Image validation: < 100ms
- Image variant generation: 200-500ms
- Image upload (4 files): 1-3s
- Video validation: < 100ms
- Video metadata extraction: 500-1000ms
- Video thumbnail generation: 1-3s
- Video upload (2 files): 2-5s
- Full test suite: 30-60s

## Notes

- Tests use real R2 storage (not mocked)
- Temporary files are cleaned up automatically
- Tests are safe to run multiple times
- Each test generates unique file keys (UUID-based)
- Video processing requires FFmpeg installed on system
- Image processing uses Sharp (no external dependencies)
