/**
 * Storage Service - Cloudflare R2 Client Wrapper
 * 
 * Provides abstraction layer for S3-compatible object storage operations
 * with Cloudflare R2. Handles file upload, deletion, and URL generation.
 * 
 * @module services/storageService
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'node:crypto'
import path from 'node:path'

/**
 * Storage Service Class
 * 
 * Manages Cloudflare R2 storage operations using AWS SDK v3.
 */
class StorageService {
  client = null

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME
    this.publicUrl = process.env.R2_PUBLIC_URL
  }

  /**
   * Initialize S3 client with R2 credentials
   * 
   * @returns {S3Client} Configured S3 client instance
   */
  getClient() {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
      })
    }
    return this.client
  }

  /**
   * Upload file buffer to R2
   * 
   * @param {Buffer} buffer - File buffer to upload
   * @param {string} key - S3 object key (file path)
   * @param {string} contentType - MIME type of the file
   * @returns {Promise<string>} Public URL of uploaded file
   */
  async upload(buffer, key, contentType) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000' // 1 year cache
      })

      const client = this.getClient()
      await client.send(command)

      const publicUrl = this.generatePublicUrl(key)
      console.log(`✅ Uploaded file to R2: ${key}`)
      
      return publicUrl
    } catch (error) {
      console.error(`❌ R2 upload failed for ${key}:`, error.message)
      throw new Error(`Failed to upload file to storage: ${error.message}`)
    }
  }

  /**
   * Delete file from R2
   * 
   * @param {string} key - S3 object key (file path)
   * @returns {Promise<void>}
   */
  async delete(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      })

      const client = this.getClient()
      await client.send(command)

      console.log(`✅ Deleted file from R2: ${key}`)
    } catch (error) {
      console.error(`❌ R2 deletion failed for ${key}:`, error.message)
      throw new Error(`Failed to delete file from storage: ${error.message}`)
    }
  }

  /**
   * Extract S3 key from public URL
   * 
   * @param {string} url - Public URL of file
   * @returns {string|null} S3 key or null if invalid URL
   */
  extractKeyFromUrl(url) {
    if (!url || !url.startsWith(this.publicUrl)) {
      return null
    }
    
    // Remove public URL base to get key
    return url.replace(`${this.publicUrl}/`, '')
  }

  /**
   * Generate public URL from S3 key
   * 
   * @param {string} key - S3 object key
   * @returns {string} Public URL
   */
  generatePublicUrl(key) {
    return `${this.publicUrl}/${key}`
  }

  /**
   * Check if R2 connection is configured
   * 
   * @returns {boolean} True if credentials are available
   */
  isConfigured() {
    return !!(
      process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL
    )
  }

  /**
   * Upload multiple files in batch
   * 
   * @param {Array<{buffer: Buffer, key: string, contentType: string}>} files - Array of files to upload
   * @returns {Promise<Array<string>>} Array of public URLs
   */
  async batchUpload(files) {
    try {
      const uploadPromises = files.map(file => 
        this.upload(file.buffer, file.key, file.contentType)
      )
      
      const urls = await Promise.all(uploadPromises)
      console.log(`✅ Batch uploaded ${files.length} file(s) to R2`)
      
      return urls
    } catch (error) {
      console.error(`❌ Batch upload failed:`, error.message)
      throw new Error(`Failed to batch upload files: ${error.message}`)
    }
  }

  /**
   * Delete multiple files in batch
   * 
   * @param {string[]} keys - Array of S3 object keys to delete
   * @returns {Promise<void>}
   */
  async batchDelete(keys) {
    try {
      const deletePromises = keys.map(key => this.delete(key))
      await Promise.allSettled(deletePromises)
      
      console.log(`✅ Batch deleted ${keys.length} file(s) from R2`)
    } catch (error) {
      console.error(`❌ Batch deletion failed:`, error.message)
      throw new Error(`Failed to batch delete files: ${error.message}`)
    }
  }

  /**
   * Generate gallery media key with date-based folder structure
   * 
   * @param {string} mediaType - Media type (images|videos)
   * @param {string} originalFilename - Original filename
   * @param {string} size - Size variant (thumbnail|medium|large|original)
   * @returns {string} S3 key path
   */
  generateGalleryKey(mediaType, originalFilename, size = 'original') {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    // Generate UUID for unique identification
    const uuid = crypto.randomUUID()
    
    // Get file extension
    const ext = size === 'original' 
      ? path.extname(originalFilename)
      : '.webp'
    
    const sizePrefix = size === 'original' ? '' : `-${size}`
    
    // Structure: gallery/{type}/{year}/{month}/{day}/{uuid}{-size}.{ext}
    return `gallery/${mediaType}/${year}/${month}/${day}/${uuid}${sizePrefix}${ext}`
  }

  /**
   * Get storage usage statistics (placeholder for future implementation)
   * 
   * @returns {Promise<Object>} Storage usage information
   */
  async getStorageStats() {
    // Placeholder for future R2 bucket statistics
    return {
      totalFiles: 0,
      totalSize: 0,
      message: 'Storage statistics not yet implemented'
    }
  }
}

// Export singleton instance
export const storageService = new StorageService()
