/**
 * Gallery Media Service
 * 
 * Main orchestrator for gallery media operations including image and video uploads,
 * multi-variant generation, metadata extraction, and storage management.
 * 
 * @module services/galleryMediaService
 */

import sharp from 'sharp'
import ExifReader from 'exifreader'
import { MEDIA_CONFIG } from '../config/media.js'
import { storageService } from './storageService.js'
import { videoProcessingService } from './videoProcessingService.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Gallery Media Service Class
 * 
 * Orchestrates gallery media operations with support for images and videos.
 */
class GalleryMediaService {
  constructor() {
    this.imageConfig = MEDIA_CONFIG.images
    this.videoConfig = MEDIA_CONFIG.videos
  }

  /**
   * Validate media file
   * 
   * @param {Object} file - Multer file object
   * @param {string} mediaType - Media type (image|video)
   * @throws {Error} If validation fails
   */
  validateMediaFile(file, mediaType) {
    if (!file) {
      throw new Error('No file provided')
    }

    const config = mediaType === 'video' ? this.videoConfig : this.imageConfig
    
    if (!config.allowedTypes.includes(file.mimetype)) {
      throw new Error(`Invalid ${mediaType} type. Allowed: ${config.allowedTypes.join(', ')}`)
    }

    if (file.size > config.maxSize) {
      const maxMB = (config.maxSize / 1024 / 1024).toFixed(2)
      throw new Error(`File too large. Max size for ${mediaType}: ${maxMB}MB`)
    }
  }

  /**
   * Extract EXIF metadata from image
   * 
   * @param {Buffer} buffer - Image buffer
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractImageMetadata(buffer) {
    try {
      const tags = ExifReader.load(buffer)
      
      return {
        camera: tags.Make?.description || null,
        model: tags.Model?.description || null,
        dateTaken: tags.DateTime?.description || null,
        gps: tags.GPSLatitude && tags.GPSLongitude ? {
          latitude: tags.GPSLatitude.description,
          longitude: tags.GPSLongitude.description,
        } : null,
        orientation: tags.Orientation?.value || 1,
        software: tags.Software?.description || null,
      }
    } catch {
      // EXIF data is optional, return null if extraction fails
      return null
    }
  }

  /**
   * Generate image variant
   * 
   * @param {Buffer} buffer - Original image buffer
   * @param {string} size - Size variant (thumbnail|medium|large)
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async generateImageVariant(buffer, size) {
    const config = this.imageConfig.variants[size]
    
    if (!config) {
      throw new Error(`Unknown variant size: ${size}`)
    }

    return sharp(buffer)
      .resize(config.width, config.height, {
        fit: config.fit,
        withoutEnlargement: true,
      })
      .webp({ quality: this.imageConfig.quality.webp })
      .toBuffer()
  }

  /**
   * Generate all image variants
   * 
   * @param {Buffer} originalBuffer - Original image buffer
   * @param {string} originalFilename - Original filename
   * @returns {Promise<Object>} Generated variants with URLs
   */
  async generateImageVariants(originalBuffer, originalFilename) {
    try {
      const variants = {}
      const variantSizes = ['thumbnail', 'medium', 'large']
      
      // Generate all variants in parallel
      const variantBuffers = await Promise.all(
        variantSizes.map(size => this.generateImageVariant(originalBuffer, size))
      )

      // Upload all variants in parallel
      const uploadPromises = variantSizes.map((size, index) => {
        const key = storageService.generateGalleryKey('images', originalFilename, size)
        return storageService.upload(variantBuffers[index], key, 'image/webp')
          .then(url => ({ size, url, key }))
      })

      const uploadedVariants = await Promise.all(uploadPromises)

      // Map results
      for (const variant of uploadedVariants) {
        variants[variant.size] = {
          url: variant.url,
          key: variant.key,
        }
      }

      return variants
    } catch (error) {
      console.error(`❌ Variant generation failed:`, error.message)
      throw new Error(`Failed to generate image variants: ${error.message}`)
    }
  }

  /**
   * Upload image with multi-variant generation
   * 
   * @param {Object} file - Multer file object
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Upload result with all URLs and metadata
   */
  async uploadImage(file, metadata = {}) {
    try {
      // Validate file
      this.validateMediaFile(file, 'image')

      // Extract EXIF metadata
      const exifData = await this.extractImageMetadata(file.buffer)

      // Get image dimensions
      const imageInfo = await sharp(file.buffer).metadata()

      // Upload original image
      const originalKey = storageService.generateGalleryKey('images', file.originalname, 'original')
      const originalUrl = await storageService.upload(
        file.buffer,
        originalKey,
        file.mimetype
      )

      // Generate and upload variants
      const variants = await this.generateImageVariants(file.buffer, file.originalname)

      console.log(`✅ Image uploaded successfully with ${Object.keys(variants).length} variants`)

      return {
        mediaType: 'image',
        originalUrl,
        r2Keys: {
          original: originalKey,
          thumbnail: variants.thumbnail.key,
          medium: variants.medium.key,
          large: variants.large.key,
        },
        r2Urls: {
          original: originalUrl,
          thumbnail: variants.thumbnail.url,
          medium: variants.medium.url,
          large: variants.large.url,
        },
        metadata: {
          filename: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          width: imageInfo.width,
          height: imageInfo.height,
          format: imageInfo.format,
          exif: exifData,
          ...metadata,
        },
      }
    } catch (error) {
      console.error(`❌ Image upload failed:`, error.message)
      throw error
    }
  }

  /**
   * Upload video with thumbnail generation
   * 
   * @param {Object} file - Multer file object
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Upload result with URLs and metadata
   */
  async uploadVideo(file, metadata = {}) {
    try {
      const result = await videoProcessingService.uploadVideo(file, file.originalname)

      console.log(`✅ Video uploaded successfully`)

      return {
        mediaType: 'video',
        originalUrl: result.originalUrl,
        r2Keys: result.r2Keys,
        r2Urls: {
          original: result.originalUrl,
          thumbnail: result.thumbnailUrl,
        },
        metadata: {
          filename: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          width: result.metadata.width,
          height: result.metadata.height,
          duration: result.metadata.duration,
          codec: result.metadata.codec,
          ...metadata,
        },
      }
    } catch (error) {
      console.error(`❌ Video upload failed:`, error.message)
      throw error
    }
  }

  /**
   * Upload media file (auto-detect type)
   * 
   * @param {Object} file - Multer file object
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Upload result
   */
  async uploadMedia(file, metadata = {}) {
    const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image'
    
    if (mediaType === 'video') {
      return this.uploadVideo(file, metadata)
    }
    
    return this.uploadImage(file, metadata)
  }

  /**
   * Delete media files from storage
   * 
   * @param {Object} r2Keys - R2 keys object
   * @param {string} mediaType - Media type (image|video)
   * @returns {Promise<void>}
   */
  async deleteMediaFiles(r2Keys, mediaType) {
    try {
      const keysToDelete = this.collectKeysToDelete(r2Keys, mediaType)

      if (keysToDelete.length > 0) {
        await storageService.batchDelete(keysToDelete)
        console.log(`✅ Deleted ${mediaType} files from R2`)
      }
    } catch (error) {
      console.error(`❌ Media deletion failed:`, error.message)
      // Don't throw - deletion failures shouldn't block operations
    }
  }

  /**
   * Collect R2 keys to delete based on media type
   * 
   * @param {Object} r2Keys - R2 keys object
   * @param {string} mediaType - Media type (image|video)
   * @returns {string[]} Array of keys to delete
   */
  collectKeysToDelete(r2Keys, mediaType) {
    const keysToDelete = []
    
    if (mediaType === 'image') {
      if (r2Keys.original) keysToDelete.push(r2Keys.original)
      if (r2Keys.thumbnail) keysToDelete.push(r2Keys.thumbnail)
      if (r2Keys.medium) keysToDelete.push(r2Keys.medium)
      if (r2Keys.large) keysToDelete.push(r2Keys.large)
    } else if (mediaType === 'video') {
      if (r2Keys.original) keysToDelete.push(r2Keys.original)
      if (r2Keys.thumbnail) keysToDelete.push(r2Keys.thumbnail)
    }

    return keysToDelete
  }

  /**
   * Create media database record with Prisma
   * 
   * @param {Object} uploadResult - Upload result from uploadMedia
   * @param {Object} additionalMetadata - Additional metadata for database
   * @returns {Promise<Object>} Created GalleryMedia record
   */
  async createMediaRecord(uploadResult, additionalMetadata = {}) {
    try {
      // Generate alt text from filename if not provided
      const alt = additionalMetadata.alt || 
                  uploadResult.metadata.filename
                    .replace(/\.[^/.]+$/, '')
                    .replaceAll(/[-_]/g, ' ')
                    .replaceAll(/\b\w/g, l => l.toUpperCase())
      
      // Create gallery media record in database
      const galleryMedia = await prisma.galleryMedia.create({
        data: {
          filename: uploadResult.metadata.filename,
          alt: alt,
          title: additionalMetadata.title || null,
          caption: additionalMetadata.caption || null,
          mediaType: uploadResult.mediaType,
          category: additionalMetadata.category || 'general',
          r2ObjectKey: uploadResult.r2Keys.original,
          r2Urls: uploadResult.r2Urls,
          featured: additionalMetadata.featured || false,
          displayOrder: additionalMetadata.displayOrder || 0,
          metadata: uploadResult.metadata,
          location: additionalMetadata.location || null,
          photographer: additionalMetadata.photographer || null,
          dateTaken: additionalMetadata.dateTaken || null,
        },
      })

      console.log(`✅ Media record created in database: ${galleryMedia.id}`)
      
      return galleryMedia
    } catch (error) {
      console.error(`❌ Failed to create media record:`, error.message)
      throw error
    }
  }

  /**
   * Get media by ID
   * 
   * @param {string} id - Media ID
   * @returns {Promise<Object|null>} GalleryMedia record or null
   */
  async getMediaById(id) {
    try {
      return await prisma.galleryMedia.findUnique({
        where: { 
          id,
          deletedAt: null, // Exclude soft-deleted records
        },
      })
    } catch (error) {
      console.error(`❌ Failed to get media by ID:`, error.message)
      throw error
    }
  }

  /**
   * Get media list with filtering, sorting, and pagination
   * 
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Paginated media list
   */
  async getMediaList(filters = {}) {
    try {
      const {
        category,
        mediaType,
        featured,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        limit = 20,
      } = filters

      // Build where clause
      const where = {
        deletedAt: null, // Exclude soft-deleted records
      }

      if (category) where.category = category
      if (mediaType) where.mediaType = mediaType
      if (featured !== undefined) where.featured = featured
      
      if (search) {
        where.OR = [
          { filename: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { caption: { contains: search, mode: 'insensitive' } },
          { alt: { contains: search, mode: 'insensitive' } },
        ]
      }

      // Build order by
      const orderBy = { [sortBy]: sortOrder }

      // Calculate pagination
      const skip = (page - 1) * limit
      const take = limit

      // Execute queries
      const [items, total] = await Promise.all([
        prisma.galleryMedia.findMany({
          where,
          orderBy,
          skip,
          take,
        }),
        prisma.galleryMedia.count({ where }),
      ])

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      console.error(`❌ Failed to get media list:`, error.message)
      throw error
    }
  }

  /**
   * Update media metadata
   * 
   * @param {string} id - Media ID
   * @param {Object} metadata - Metadata updates
   * @returns {Promise<Object>} Updated GalleryMedia record
   */
  async updateMediaMetadata(id, metadata) {
    try {
      return await prisma.galleryMedia.update({
        where: { id },
        data: {
          ...metadata,
          updatedAt: new Date(),
        },
      })
    } catch (error) {
      console.error(`❌ Failed to update media metadata:`, error.message)
      throw error
    }
  }

  /**
   * Soft delete media (sets deletedAt timestamp)
   * 
   * @param {string} id - Media ID
   * @returns {Promise<Object>} Updated GalleryMedia record
   */
  async deleteMedia(id) {
    try {
      return await prisma.galleryMedia.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      })
    } catch (error) {
      console.error(`❌ Failed to soft delete media:`, error.message)
      throw error
    }
  }

  /**
   * Hard delete media (permanently removes from database and R2)
   * 
   * @param {string} id - Media ID
   * @returns {Promise<void>}
   */
  async hardDeleteMedia(id) {
    try {
      // Get media record
      const media = await prisma.galleryMedia.findUnique({
        where: { id },
      })

      if (!media) {
        throw new Error(`Media ${id} not found`)
      }

      // Delete from R2 storage
      await this.deleteMediaFiles(media.r2Urls, media.mediaType)

      // Delete from database
      await prisma.galleryMedia.delete({
        where: { id },
      })

      console.log(`🗑️ Hard deleted media: ${id}`)
    } catch (error) {
      console.error(`❌ Failed to hard delete media:`, error.message)
      throw error
    }
  }

  /**
   * Bulk soft delete media
   * 
   * @param {string[]} ids - Array of media IDs
   * @returns {Promise<Object>} Operation result
   */
  async bulkDeleteMedia(ids) {
    try {
      const result = await prisma.galleryMedia.updateMany({
        where: {
          id: { in: ids },
        },
        data: {
          deletedAt: new Date(),
        },
      })

      return {
        count: result.count,
        ids,
      }
    } catch (error) {
      console.error(`❌ Failed to bulk delete media:`, error.message)
      throw error
    }
  }

  /**
   * Restore soft-deleted media
   * 
   * @param {string} id - Media ID
   * @returns {Promise<Object>} Restored GalleryMedia record
   */
  async restoreDeletedMedia(id) {
    try {
      return await prisma.galleryMedia.update({
        where: { id },
        data: {
          deletedAt: null,
        },
      })
    } catch (error) {
      console.error(`❌ Failed to restore media:`, error.message)
      throw error
    }
  }

  /**
   * Get media by category
   * 
   * @param {string} category - Category name
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Object[]>} Array of GalleryMedia records
   */
  async getMediaByCategory(category, limit = 100) {
    try {
      return await prisma.galleryMedia.findMany({
        where: {
          category,
          deletedAt: null,
        },
        orderBy: {
          displayOrder: 'asc',
        },
        take: limit,
      })
    } catch (error) {
      console.error(`❌ Failed to get media by category:`, error.message)
      throw error
    }
  }

  /**
   * Get featured media
   * 
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Object[]>} Array of featured GalleryMedia records
   */
  async getFeaturedMedia(limit = 10) {
    try {
      return await prisma.galleryMedia.findMany({
        where: {
          featured: true,
          deletedAt: null,
        },
        orderBy: {
          displayOrder: 'asc',
        },
        take: limit,
      })
    } catch (error) {
      console.error(`❌ Failed to get featured media:`, error.message)
      throw error
    }
  }

  /**
   * Search media across multiple fields
   * 
   * @param {string} query - Search query
   * @returns {Promise<Object[]>} Array of matching GalleryMedia records
   */
  async searchMedia(query) {
    try {
      return await prisma.galleryMedia.findMany({
        where: {
          deletedAt: null,
          OR: [
            { filename: { contains: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } },
            { caption: { contains: query, mode: 'insensitive' } },
            { alt: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
            { photographer: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    } catch (error) {
      console.error(`❌ Failed to search media:`, error.message)
      throw error
    }
  }

  /**
   * Clean up old soft-deleted media (hard delete)
   * 
   * @param {number} olderThanDays - Delete records older than this many days
   * @returns {Promise<Object>} Cleanup report
   */
  async cleanupDeletedMedia(olderThanDays = 30) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      // Find media to cleanup
      const mediaToDelete = await prisma.galleryMedia.findMany({
        where: {
          deletedAt: {
            lt: cutoffDate,
          },
        },
      })

      let deletedCount = 0
      let failedCount = 0
      const errors = []

      // Delete each media (including R2 files)
      for (const media of mediaToDelete) {
        try {
          await this.hardDeleteMedia(media.id)
          deletedCount++
        } catch (error_) {
          failedCount++
          errors.push({
            id: media.id,
            filename: media.filename,
            error: error_.message,
          })
        }
      }

      return {
        deletedCount,
        failedCount,
        errors,
        cutoffDate,
      }
    } catch (error) {
      console.error(`❌ Failed to cleanup deleted media:`, error.message)
      throw error
    }
  }

  /**
   * Check if service is configured
   * 
   * @returns {boolean} True if storage and processing services are available
   */
  isConfigured() {
    return storageService.isConfigured()
  }
}

// Export singleton instance
export const galleryMediaService = new GalleryMediaService()
