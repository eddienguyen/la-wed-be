/**
 * Image Service - Image Processing & Upload Management
 * 
 * Handles image validation, processing with Sharp, and upload to R2.
 * Generates date-based folder structure for organized storage.
 * 
 * @module services/imageService
 */

import sharp from 'sharp'
import { storageService } from './storageService.js'

/**
 * Image Service Class
 * 
 * Manages image processing pipeline from validation to upload.
 */
class ImageService {
  constructor() {
    this.maxSize = parseInt(process.env.MAX_IMAGE_SIZE || '5242880') // 5MB default
    this.quality = parseInt(process.env.IMAGE_QUALITY || '85')
    this.allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(',')
  }

  /**
   * Validate uploaded file
   * 
   * @param {Object} file - Multer file object
   * @throws {Error} If validation fails
   */
  validateImage(file) {
    if (!file) {
      throw new Error('No file provided')
    }

    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type. Allowed: ${this.allowedTypes.join(', ')}`)
    }

    if (file.size > this.maxSize) {
      const maxMB = (this.maxSize / 1024 / 1024).toFixed(2)
      throw new Error(`File too large. Max size: ${maxMB}MB`)
    }
  }

  /**
   * Process image with Sharp (optimize, resize, convert to JPEG)
   * 
   * @param {Buffer} buffer - Original image buffer
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async processImage(buffer) {
    try {
      return await sharp(buffer)
        .resize(1600, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: this.quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer()
    } catch (error) {
      console.error('❌ Image processing failed:', error.message)
      throw new Error(`Failed to process image: ${error.message}`)
    }
  }

  /**
   * Generate filename with date-based folder structure
   * 
   * @param {string} guestId - Guest UUID
   * @param {string} venue - Venue name (hue/hanoi)
   * @param {string} type - Image type (front/main)
   * @returns {string} S3 key path
   */
  generateFilename(guestId, venue, type) {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    // Structure: invitations/{venue}/{year}/{month}/{day}/{guestId}-{type}.jpg
    return `invitations/${venue}/${year}/${month}/${day}/${guestId}-${type}.jpg`
  }

  /**
   * Upload and process single image
   * 
   * @param {Object} file - Multer file object
   * @param {string} guestId - Guest UUID
   * @param {string} venue - Venue name
   * @param {string} type - Image type (front/main)
   * @returns {Promise<string>} Public URL of uploaded image
   */
  async uploadImage(file, guestId, venue, type) {
    try {
      // Validate file
      this.validateImage(file)

      // Process image
      const processedBuffer = await this.processImage(file.buffer)

      // Generate filename
      const key = this.generateFilename(guestId, venue, type)

      // Upload to R2
      const publicUrl = await storageService.upload(
        processedBuffer,
        key,
        'image/jpeg'
      )

      console.log(`✅ Image uploaded successfully: ${type} for guest ${guestId}`)
      return publicUrl
    } catch (error) {
      console.error(`❌ Image upload failed:`, error.message)
      throw error
    }
  }

  /**
   * Delete image from storage
   * 
   * @param {string} imageUrl - Public URL of image to delete
   * @returns {Promise<void>}
   */
  async deleteImage(imageUrl) {
    if (!imageUrl) {
      return
    }

    try {
      const key = storageService.extractKeyFromUrl(imageUrl)
      if (key) {
        await storageService.delete(key)
        console.log(`✅ Deleted image: ${key}`)
      }
    } catch (error) {
      console.error(`❌ Image deletion failed:`, error.message)
      // Don't throw - deletion failures shouldn't block other operations
    }
  }

  /**
   * Delete multiple images
   * 
   * @param {string[]} imageUrls - Array of image URLs to delete
   * @returns {Promise<void>}
   */
  async deleteImages(imageUrls) {
    const validUrls = imageUrls.filter(url => url)
    
    if (validUrls.length === 0) {
      return
    }

    console.log(`🗑️ Deleting ${validUrls.length} image(s)...`)
    
    const deletePromises = validUrls.map(url => this.deleteImage(url))
    await Promise.allSettled(deletePromises)
  }

  /**
   * Check if image service is configured
   * 
   * @returns {boolean} True if R2 storage is configured
   */
  isConfigured() {
    return storageService.isConfigured()
  }
}

// Export singleton instance
export const imageService = new ImageService()
