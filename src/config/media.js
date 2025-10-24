/**
 * Media Processing Configuration
 * 
 * Centralized configuration for gallery media processing including
 * image variants, video settings, and cleanup policies.
 * 
 * @module config/media
 */

/**
 * Media processing configuration object
 */
export const MEDIA_CONFIG = {
  /**
   * Image processing settings
   */
  images: {
    // Maximum file size in bytes (10MB default)
    maxSize: Number.parseInt(process.env.GALLERY_MAX_IMAGE_SIZE || '10485760'),
    
    // Allowed MIME types
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'],
    
    // Quality settings for compression
    quality: {
      jpeg: Number.parseInt(process.env.GALLERY_IMAGE_QUALITY || '85'),
      webp: Number.parseInt(process.env.GALLERY_WEBP_QUALITY || '80'),
    },
    
    // Size variants to generate
    variants: {
      thumbnail: {
        width: Number.parseInt(process.env.GALLERY_THUMBNAIL_SIZE || '400'),
        height: null,
        fit: 'inside',
      },
      medium: {
        width: Number.parseInt(process.env.GALLERY_MEDIUM_SIZE || '800'),
        height: null,
        fit: 'inside',
      },
      large: {
        width: Number.parseInt(process.env.GALLERY_LARGE_SIZE || '1200'),
        height: null,
        fit: 'inside',
      },
    },
  },

  /**
   * Video processing settings
   */
  videos: {
    // Maximum file size in bytes (100MB default)
    maxSize: Number.parseInt(process.env.GALLERY_MAX_VIDEO_SIZE || '104857600'),
    
    // Allowed MIME types
    allowedTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    
    // Thumbnail extraction settings
    thumbnailTime: Number.parseInt(process.env.GALLERY_VIDEO_THUMBNAIL_TIME || '1'),
    
    // Thumbnail size
    thumbnailSize: {
      width: 400,
      height: 300,
      fit: 'cover',
    },
  },

  /**
   * Cleanup service settings
   */
  cleanup: {
    // Cleanup interval in seconds (24 hours default)
    interval: Number.parseInt(process.env.GALLERY_CLEANUP_INTERVAL || '86400'),
    
    // Days to keep orphaned files before deletion
    retentionDays: 30,
    
    // Enable/disable automatic cleanup
    enabled: process.env.GALLERY_CLEANUP_ENABLED !== 'false',
  },

  /**
   * Storage settings
   */
  storage: {
    // Base path for gallery media in R2
    basePath: 'gallery',
    
    // Date-based folder structure
    useDateFolders: true,
    
    // Cache control for uploaded files
    cacheControl: 'public, max-age=31536000', // 1 year
  },

  /**
   * Processing settings
   */
  processing: {
    // Maximum concurrent variant generation
    concurrentVariants: 3,
    
    // Retry attempts for failed uploads
    maxRetries: 3,
    
    // Exponential backoff base (ms)
    retryBackoffBase: 1000,
  },
};

/**
 * Get size variant configuration
 * 
 * @param {string} size - Size variant name (thumbnail|medium|large)
 * @returns {Object} Variant configuration
 */
export const getVariantConfig = (size) => {
  return MEDIA_CONFIG.images.variants[size] || null;
};

/**
 * Validate media type
 * 
 * @param {string} mimeType - MIME type to validate
 * @param {string} mediaType - Media type (image|video)
 * @returns {boolean} True if valid
 */
export const isValidMediaType = (mimeType, mediaType) => {
  if (mediaType === 'image') {
    return MEDIA_CONFIG.images.allowedTypes.includes(mimeType);
  }
  if (mediaType === 'video') {
    return MEDIA_CONFIG.videos.allowedTypes.includes(mimeType);
  }
  return false;
};

/**
 * Get max file size for media type
 * 
 * @param {string} mediaType - Media type (image|video)
 * @returns {number} Max file size in bytes
 */
export const getMaxFileSize = (mediaType) => {
  return mediaType === 'video' 
    ? MEDIA_CONFIG.videos.maxSize 
    : MEDIA_CONFIG.images.maxSize;
};
