/**
 * Storage Service - Cloudflare R2 Client Wrapper
 * 
 * Provides abstraction layer for S3-compatible object storage operations
 * with Cloudflare R2. Handles file upload, deletion, and URL generation.
 * 
 * @module services/storageService
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

/**
 * Storage Service Class
 * 
 * Manages Cloudflare R2 storage operations using AWS SDK v3.
 */
class StorageService {
  constructor() {
    this.client = null
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
}

// Export singleton instance
export const storageService = new StorageService()
