/**
 * Gallery Media Service Integration Tests
 * 
 * Tests the complete gallery media pipeline:
 * - Image upload with variant generation
 * - Video upload with thumbnail generation
 * - Batch operations
 * - Error handling and cleanup
 * - R2 storage integration
 */

const fs = require('node:fs');
const path = require('node:path');
const { galleryMediaService } = require('../src/services/galleryMediaService');
const { videoProcessingService } = require('../src/services/videoProcessingService');
const { storageService } = require('../src/services/storageService');

describe('Gallery Media Service Integration Tests', () => {
  // Test fixtures paths
  const FIXTURES_DIR = path.join(__dirname, 'fixtures');
  const TEST_IMAGE = path.join(FIXTURES_DIR, 'test-image.jpg');
  const TEST_VIDEO = path.join(FIXTURES_DIR, 'test-video.mp4');
  
  // Store uploaded keys for cleanup
  const uploadedKeys = [];
  
  beforeAll(() => {
    // Ensure fixtures directory exists
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
  });
  
  afterAll(async () => {
    // Cleanup all uploaded files from R2
    if (uploadedKeys.length > 0) {
      try {
        await storageService.batchDelete(uploadedKeys);
        console.log(`✓ Cleaned up ${uploadedKeys.length} test files from R2`);
      } catch (error) {
        console.error('Failed to cleanup test files:', error.message);
      }
    }
  });
  
  describe('Image Upload Pipeline', () => {
    test('should validate image file successfully', async () => {
      if (!fs.existsSync(TEST_IMAGE)) {
        console.warn('⚠ Test image not found, skipping validation test');
        return;
      }
      
      const file = {
        buffer: fs.readFileSync(TEST_IMAGE),
        mimetype: 'image/jpeg',
        size: fs.statSync(TEST_IMAGE).size,
        originalname: 'test-image.jpg'
      };
      
      const isValid = await galleryMediaService.validateMediaFile(file, 'image');
      expect(isValid).toBe(true);
    });
    
    test('should reject oversized image', async () => {
      const file = {
        buffer: Buffer.alloc(1024 * 1024 * 11), // 11MB > 10MB limit
        mimetype: 'image/jpeg',
        size: 1024 * 1024 * 11,
        originalname: 'large-image.jpg'
      };
      
      await expect(
        galleryMediaService.validateMediaFile(file, 'image')
      ).rejects.toThrow('exceeds maximum allowed size');
    });
    
    test('should generate image variants with correct sizes', async () => {
      if (!fs.existsSync(TEST_IMAGE)) {
        console.warn('⚠ Test image not found, skipping variant generation test');
        return;
      }
      
      const originalBuffer = fs.readFileSync(TEST_IMAGE);
      const variants = await galleryMediaService.generateImageVariants(originalBuffer);
      
      expect(variants).toHaveProperty('thumbnail');
      expect(variants).toHaveProperty('medium');
      expect(variants).toHaveProperty('large');
      expect(variants.thumbnail).toBeInstanceOf(Buffer);
      expect(variants.medium).toBeInstanceOf(Buffer);
      expect(variants.large).toBeInstanceOf(Buffer);
      
      // Thumbnail should be smaller than original
      expect(variants.thumbnail.length).toBeLessThan(originalBuffer.length);
    });
    
    test('should extract image metadata from EXIF', async () => {
      if (!fs.existsSync(TEST_IMAGE)) {
        console.warn('⚠ Test image not found, skipping metadata extraction test');
        return;
      }
      
      const buffer = fs.readFileSync(TEST_IMAGE);
      const metadata = await galleryMediaService.extractImageMetadata(buffer);
      
      expect(metadata).toHaveProperty('width');
      expect(metadata).toHaveProperty('height');
      expect(metadata).toHaveProperty('format');
      
      // Check for optional EXIF data
      if (metadata.exif) {
        expect(metadata.exif).toBeInstanceOf(Object);
      }
    });
    
    test('should upload image with all variants to R2', async () => {
      if (!fs.existsSync(TEST_IMAGE)) {
        console.warn('⚠ Test image not found, skipping upload test');
        return;
      }
      
      const file = {
        buffer: fs.readFileSync(TEST_IMAGE),
        mimetype: 'image/jpeg',
        size: fs.statSync(TEST_IMAGE).size,
        originalname: 'test-image.jpg'
      };
      
      const metadata = {
        title: 'Integration Test Image',
        description: 'Uploaded during integration testing',
        tags: ['test', 'integration']
      };
      
      const result = await galleryMediaService.uploadImage(file, metadata);
      
      // Verify result structure
      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('variants');
      expect(result.variants).toHaveProperty('thumbnail');
      expect(result.variants).toHaveProperty('medium');
      expect(result.variants).toHaveProperty('large');
      
      // Verify URLs
      expect(result.original.url).toContain('r2.cloudflarestorage.com');
      expect(result.variants.thumbnail.url).toContain('r2.cloudflarestorage.com');
      
      // Store keys for cleanup
      uploadedKeys.push(
        result.original.key,
        result.variants.thumbnail.key,
        result.variants.medium.key,
        result.variants.large.key
      );
      
      console.log('✓ Uploaded image with 4 variants:', {
        original: result.original.key,
        thumbnail: result.variants.thumbnail.key,
        medium: result.variants.medium.key,
        large: result.variants.large.key
      });
    }, 30000); // 30s timeout for R2 upload
  });
  
  describe('Video Upload Pipeline', () => {
    test('should validate video file successfully', async () => {
      if (!fs.existsSync(TEST_VIDEO)) {
        console.warn('⚠ Test video not found, skipping validation test');
        return;
      }
      
      const file = {
        buffer: fs.readFileSync(TEST_VIDEO),
        mimetype: 'video/mp4',
        size: fs.statSync(TEST_VIDEO).size,
        originalname: 'test-video.mp4'
      };
      
      const isValid = await videoProcessingService.validateVideo(file);
      expect(isValid).toBe(true);
    });
    
    test('should reject oversized video', async () => {
      const file = {
        buffer: Buffer.alloc(1024 * 1024 * 101), // 101MB > 100MB limit
        mimetype: 'video/mp4',
        size: 1024 * 1024 * 101,
        originalname: 'large-video.mp4'
      };
      
      await expect(
        videoProcessingService.validateVideo(file)
      ).rejects.toThrow('exceeds maximum allowed size');
    });
    
    test('should extract video metadata with FFmpeg', async () => {
      if (!fs.existsSync(TEST_VIDEO)) {
        console.warn('⚠ Test video not found, skipping metadata extraction test');
        return;
      }
      
      const buffer = fs.readFileSync(TEST_VIDEO);
      const metadata = await videoProcessingService.extractMetadata(buffer);
      
      expect(metadata).toHaveProperty('duration');
      expect(metadata).toHaveProperty('width');
      expect(metadata).toHaveProperty('height');
      expect(metadata).toHaveProperty('codec');
      expect(typeof metadata.duration).toBe('number');
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
    }, 15000); // 15s timeout for FFmpeg
    
    test('should generate video thumbnail', async () => {
      if (!fs.existsSync(TEST_VIDEO)) {
        console.warn('⚠ Test video not found, skipping thumbnail generation test');
        return;
      }
      
      const videoBuffer = fs.readFileSync(TEST_VIDEO);
      const thumbnail = await videoProcessingService.generateThumbnail(videoBuffer);
      
      expect(thumbnail).toBeInstanceOf(Buffer);
      expect(thumbnail.length).toBeGreaterThan(0);
      
      // Thumbnail should be significantly smaller than original video
      expect(thumbnail.length).toBeLessThan(videoBuffer.length);
    }, 15000); // 15s timeout for FFmpeg + Sharp
    
    test('should upload video with thumbnail to R2', async () => {
      if (!fs.existsSync(TEST_VIDEO)) {
        console.warn('⚠ Test video not found, skipping upload test');
        return;
      }
      
      const file = {
        buffer: fs.readFileSync(TEST_VIDEO),
        mimetype: 'video/mp4',
        size: fs.statSync(TEST_VIDEO).size,
        originalname: 'test-video.mp4'
      };
      
      const metadata = {
        title: 'Integration Test Video',
        description: 'Uploaded during integration testing',
        tags: ['test', 'video', 'integration']
      };
      
      const result = await galleryMediaService.uploadVideo(file, metadata);
      
      // Verify result structure
      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('metadata');
      
      // Verify URLs
      expect(result.original.url).toContain('r2.cloudflarestorage.com');
      expect(result.thumbnail.url).toContain('r2.cloudflarestorage.com');
      
      // Verify metadata
      expect(result.metadata).toHaveProperty('duration');
      expect(result.metadata).toHaveProperty('width');
      expect(result.metadata).toHaveProperty('height');
      
      // Store keys for cleanup
      uploadedKeys.push(result.original.key, result.thumbnail.key);
      
      console.log('✓ Uploaded video with thumbnail:', {
        original: result.original.key,
        thumbnail: result.thumbnail.key,
        duration: result.metadata.duration,
        resolution: `${result.metadata.width}x${result.metadata.height}`
      });
    }, 45000); // 45s timeout for video processing + upload
  });
  
  describe('Auto-Detection Upload', () => {
    test('should auto-detect and upload image', async () => {
      if (!fs.existsSync(TEST_IMAGE)) {
        console.warn('⚠ Test image not found, skipping auto-detect test');
        return;
      }
      
      const file = {
        buffer: fs.readFileSync(TEST_IMAGE),
        mimetype: 'image/jpeg',
        size: fs.statSync(TEST_IMAGE).size,
        originalname: 'auto-detect-image.jpg'
      };
      
      const result = await galleryMediaService.uploadMedia(file, {
        title: 'Auto-detected Image'
      });
      
      expect(result).toHaveProperty('variants');
      
      // Store keys for cleanup
      const variantKeys = [];
      for (const variant of Object.values(result.variants)) {
        variantKeys.push(variant.key);
      }
      uploadedKeys.push(result.original.key, ...variantKeys);
    }, 30000);
    
    test('should auto-detect and upload video', async () => {
      if (!fs.existsSync(TEST_VIDEO)) {
        console.warn('⚠ Test video not found, skipping auto-detect test');
        return;
      }
      
      const file = {
        buffer: fs.readFileSync(TEST_VIDEO),
        mimetype: 'video/mp4',
        size: fs.statSync(TEST_VIDEO).size,
        originalname: 'auto-detect-video.mp4'
      };
      
      const result = await galleryMediaService.uploadMedia(file, {
        title: 'Auto-detected Video'
      });
      
      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('metadata');
      
      // Store keys for cleanup
      uploadedKeys.push(result.original.key, result.thumbnail.key);
    }, 45000);
  });
  
  describe('Batch Operations', () => {
    test('should delete multiple image files', async () => {
      // Create test keys to delete (simulating uploaded files)
      const testKeys = [
        'gallery/images/2025/01/15/original-test.jpg',
        'gallery/images/2025/01/15/original-test-thumbnail.jpg',
        'gallery/images/2025/01/15/original-test-medium.jpg',
        'gallery/images/2025/01/15/original-test-large.jpg'
      ];
      
      // This will attempt to delete (will fail gracefully if not exist)
      const result = await galleryMediaService.deleteMediaFiles(testKeys, 'image');
      
      expect(result).toHaveProperty('deleted');
      expect(result).toHaveProperty('failed');
      expect(Array.isArray(result.deleted)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
    });
    
    test('should delete multiple video files', async () => {
      const testKeys = [
        'gallery/videos/2025/01/15/original-test.mp4',
        'gallery/videos/2025/01/15/original-test-thumbnail.webp'
      ];
      
      const result = await galleryMediaService.deleteMediaFiles(testKeys, 'video');
      
      expect(result).toHaveProperty('deleted');
      expect(result).toHaveProperty('failed');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle invalid file type gracefully', async () => {
      const file = {
        buffer: Buffer.from('invalid data'),
        mimetype: 'application/pdf',
        size: 100,
        originalname: 'document.pdf'
      };
      
      await expect(
        galleryMediaService.uploadMedia(file, {})
      ).rejects.toThrow('Unsupported media type');
    });
    
    test('should handle corrupted image buffer', async () => {
      const file = {
        buffer: Buffer.from('not an image'),
        mimetype: 'image/jpeg',
        size: 100,
        originalname: 'corrupted.jpg'
      };
      
      await expect(
        galleryMediaService.uploadImage(file, {})
      ).rejects.toThrow();
    });
    
    test('should handle missing file buffer', async () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 100,
        originalname: 'missing.jpg'
      };
      
      await expect(
        galleryMediaService.uploadImage(file, {})
      ).rejects.toThrow();
    });
  });
  
  describe('Storage Service Integration', () => {
    test('should generate valid gallery keys', () => {
      const key1 = storageService.generateGalleryKey('images', 'test.jpg');
      const key2 = storageService.generateGalleryKey('images', 'test.jpg', 'thumbnail');
      
      expect(key1).toMatch(/^gallery\/images\/\d{4}\/\d{2}\/\d{2}\/.+\.jpg$/);
      expect(key2).toMatch(/^gallery\/images\/\d{4}\/\d{2}\/\d{2}\/.+-thumbnail\.jpg$/);
      
      // Keys should be different (UUID-based)
      expect(key1).not.toBe(key2);
    });
    
    test('should handle batch upload', async () => {
      const files = [
        {
          key: 'test/batch-1.txt',
          buffer: Buffer.from('test content 1'),
          contentType: 'text/plain'
        },
        {
          key: 'test/batch-2.txt',
          buffer: Buffer.from('test content 2'),
          contentType: 'text/plain'
        }
      ];
      
      const results = await storageService.batchUpload(files);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('status', 'fulfilled');
      expect(results[1]).toHaveProperty('status', 'fulfilled');
      
      // Store for cleanup
      uploadedKeys.push('test/batch-1.txt', 'test/batch-2.txt');
    });
  });
});
