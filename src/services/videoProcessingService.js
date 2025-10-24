/**
 * Video Processing Service
 * 
 * Handles video thumbnail generation and metadata extraction using FFmpeg.
 * Provides utilities for video validation and processing.
 * 
 * @module services/videoProcessingService
 */

import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { MEDIA_CONFIG } from '../config/media.js'
import { storageService } from './storageService.js'

/**
 * Video Processing Service Class
 * 
 * Manages video processing operations including thumbnail generation
 * and metadata extraction.
 */
class VideoProcessingService {
  constructor() {
    this.thumbnailTime = MEDIA_CONFIG.videos.thumbnailTime
    this.thumbnailSize = MEDIA_CONFIG.videos.thumbnailSize
    this.maxSize = MEDIA_CONFIG.videos.maxSize
    this.allowedTypes = MEDIA_CONFIG.videos.allowedTypes
  }

  /**
   * Validate video file
   * 
   * @param {Object} file - Multer file object
   * @throws {Error} If validation fails
   */
  validateVideo(file) {
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
   * Extract video metadata
   * 
   * @param {Buffer} buffer - Video buffer
   * @returns {Promise<Object>} Video metadata
   */
  async extractMetadata(buffer) {
    return new Promise((resolve, reject) => {
      // Create temporary file path for FFmpeg processing
      const tempPath = `/tmp/video-${Date.now()}.mp4`
      
      // Write buffer to temp file
      require('node:fs').writeFileSync(tempPath, buffer)

      ffmpeg(tempPath)
        .ffprobe((err, metadata) => {
          // Clean up temp file
          try {
            require('node:fs').unlinkSync(tempPath)
          } catch (error_) {
            console.error('Failed to clean up temp file:', error_)
          }

          if (err) {
            reject(new Error(`Failed to extract video metadata: ${err.message}`))
            return
          }

          const videoStream = metadata.streams.find(s => s.codec_type === 'video')
          
          if (!videoStream) {
            reject(new Error('No video stream found in file'))
            return
          }

          resolve({
            duration: metadata.format.duration,
            width: videoStream.width,
            height: videoStream.height,
            codec: videoStream.codec_name,
            bitrate: metadata.format.bit_rate,
            fps: this.calculateFPS(videoStream.r_frame_rate),
            fileSize: metadata.format.size,
          })
        })
    })
  }

  /**
   * Calculate FPS from frame rate string
   * 
   * @param {string} frameRate - Frame rate string (e.g., "30/1")
   * @returns {number} FPS value
   */
  calculateFPS(frameRate) {
    if (!frameRate) return 0
    
    const parts = frameRate.split('/')
    if (parts.length === 2) {
      return Number.parseInt(parts[0], 10) / Number.parseInt(parts[1], 10)
    }
    
    return Number.parseFloat(frameRate)
  }

  /**
   * Generate thumbnail from video
   * 
   * @param {Buffer} videoBuffer - Video file buffer
   * @param {string} originalFilename - Original video filename
   * @returns {Promise<Buffer>} Thumbnail image buffer
   */
  async generateThumbnail(videoBuffer, originalFilename) {
    return new Promise((resolve, reject) => {
      const tempVideoPath = `/tmp/video-${Date.now()}.mp4`
      const tempThumbPath = `/tmp/thumb-${Date.now()}.png`
      
      // Write buffer to temp file
      require('node:fs').writeFileSync(tempVideoPath, videoBuffer)

      ffmpeg(tempVideoPath)
        .screenshots({
          timestamps: [this.thumbnailTime],
          filename: require('node:path').basename(tempThumbPath),
          folder: require('node:path').dirname(tempThumbPath),
          size: `${this.thumbnailSize.width}x${this.thumbnailSize.height}`,
        })
        .on('end', async () => {
          try {
            // Read generated thumbnail
            const thumbnailBuffer = require('node:fs').readFileSync(tempThumbPath)
            
            // Process with Sharp for optimization
            const optimizedBuffer = await sharp(thumbnailBuffer)
              .resize(this.thumbnailSize.width, this.thumbnailSize.height, {
                fit: this.thumbnailSize.fit,
                withoutEnlargement: true,
              })
              .webp({ quality: MEDIA_CONFIG.images.quality.webp })
              .toBuffer()

            // Clean up temp files
            try {
              require('node:fs').unlinkSync(tempVideoPath)
              require('node:fs').unlinkSync(tempThumbPath)
            } catch (error_) {
              console.error('Failed to clean up temp files:', error_)
            }

            resolve(optimizedBuffer)
          } catch (err) {
            reject(new Error(`Failed to process thumbnail: ${err.message}`))
          }
        })
        .on('error', (err) => {
          // Clean up temp files on error
          try {
            require('node:fs').unlinkSync(tempVideoPath)
          } catch (error_) {
            console.error('Failed to clean up temp video file:', error_)
          }
          
          reject(new Error(`Failed to generate thumbnail: ${err.message}`))
        })
    })
  }

  /**
   * Upload video and generate thumbnail
   * 
   * @param {Object} file - Multer file object
   * @param {string} originalFilename - Original filename
   * @returns {Promise<Object>} Upload result with URLs and metadata
   */
  async uploadVideo(file, originalFilename) {
    try {
      // Validate video
      this.validateVideo(file)

      // Extract metadata
      const metadata = await this.extractMetadata(file.buffer)

      // Generate R2 keys
      const videoKey = storageService.generateGalleryKey('videos', originalFilename, 'original')
      const thumbnailKey = storageService.generateGalleryKey('videos', originalFilename, 'thumbnail')

      // Upload original video
      const videoUrl = await storageService.upload(
        file.buffer,
        videoKey,
        file.mimetype
      )

      // Generate and upload thumbnail
      const thumbnailBuffer = await this.generateThumbnail(file.buffer, originalFilename)
      const thumbnailUrl = await storageService.upload(
        thumbnailBuffer,
        thumbnailKey,
        'image/webp'
      )

      console.log(`✅ Video uploaded successfully with thumbnail`)

      return {
        originalUrl: videoUrl,
        thumbnailUrl,
        r2Keys: {
          original: videoKey,
          thumbnail: thumbnailKey,
        },
        metadata,
      }
    } catch (error) {
      console.error(`❌ Video upload failed:`, error.message)
      throw error
    }
  }

  /**
   * Delete video files from storage
   * 
   * @param {Object} r2Keys - R2 keys object
   * @returns {Promise<void>}
   */
  async deleteVideo(r2Keys) {
    try {
      const keysToDelete = []
      
      if (r2Keys.original) keysToDelete.push(r2Keys.original)
      if (r2Keys.thumbnail) keysToDelete.push(r2Keys.thumbnail)

      if (keysToDelete.length > 0) {
        await storageService.batchDelete(keysToDelete)
        console.log(`✅ Deleted video and thumbnail from R2`)
      }
    } catch (error) {
      console.error(`❌ Video deletion failed:`, error.message)
      // Don't throw - deletion failures shouldn't block operations
    }
  }

  /**
   * Check if video processing is available
   * 
   * @returns {boolean} True if FFmpeg is available
   */
  isConfigured() {
    try {
      // Basic check - FFmpeg will throw if not available
      ffmpeg.getAvailableFormats((err) => {
        return !err
      })
      return storageService.isConfigured()
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const videoProcessingService = new VideoProcessingService()
