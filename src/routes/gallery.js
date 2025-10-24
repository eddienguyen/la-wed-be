/**
 * Gallery Routes
 * 
 * Public REST API endpoints for gallery media management.
 * Provides read-only access to gallery content with pagination,
 * filtering, and search capabilities.
 * 
 * @module routes/gallery
 */

import express from 'express'
import rateLimit from 'express-rate-limit'
import { PrismaClient } from '@prisma/client'
import {
  validateGalleryQuery,
  validateGalleryById,
  validateGalleryUpload,
  validateGalleryUpdate,
  validateGalleryDelete,
  validateGalleryReorder,
  handleValidationErrors
} from '../middleware/galleryValidation.js'
import {
  uploadGalleryMedia,
  validateFileSize,
  handleUploadError
} from '../middleware/galleryUpload.js'
import { authenticateAdmin } from '../middleware/authMiddleware.js'
import {
  buildPaginationMeta,
  buildGalleryWhereClause,
  buildGalleryOrderBy,
  formatGalleryItem,
  formatSuccessResponse,
  formatErrorResponse,
  normalizePaginationParams
} from '../utils/galleryHelpers.js'
import { galleryMediaService } from '../services/galleryMediaService.js'

const router = express.Router()
const prisma = new PrismaClient()

/**
 * Rate limiting configurations
 */
const publicRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many gallery requests. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
}

const adminRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 50, // 50 admin requests per window
  message: {
    success: false,
    error: 'Too many admin requests. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
}

const uploadRateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // 10 uploads per hour in production, 100 in development
  message: {
    success: false,
    error: 'Upload limit exceeded. Please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false
}

// Rate limiters
const publicRateLimiter = rateLimit(publicRateLimitConfig)
const adminRateLimiter = rateLimit(adminRateLimitConfig)
const uploadRateLimiter = rateLimit(uploadRateLimitConfig)

// Simple in-memory cache for featured items
let featuredCache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000 // 5 minutes
}

/**
 * GET /api/gallery - Public gallery listing
 * 
 * Fetch gallery media with pagination, filtering, and sorting.
 * 
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page (max 50)
 * @query {string} [category] - Filter by category
 * @query {boolean} [featured] - Filter by featured status
 * @query {string} [search] - Search in title/caption/alt/filename
 * @query {string} [sortBy=createdAt] - Sort field
 * @query {string} [sortOrder=desc] - Sort direction
 * 
 * @returns {Object} 200 - Gallery items with pagination
 * @returns {Object} 400 - Invalid query parameters
 * @returns {Object} 429 - Rate limit exceeded
 * @returns {Object} 500 - Server error
 */
router.get(
  '/',
  publicRateLimiter,
  validateGalleryQuery,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { category, featured, search, sortBy, sortOrder } = req.query
      
      // Normalize pagination params
      const { page, limit, skip } = normalizePaginationParams(
        req.query.page,
        req.query.limit
      )

      // Build where clause
      const where = buildGalleryWhereClause({
        category,
        featured,
        search,
        includeDeleted: false
      })

      // Build order by clause
      const orderBy = buildGalleryOrderBy(sortBy, sortOrder)

      // Execute queries in parallel
      const [items, total] = await Promise.all([
        prisma.galleryMedia.findMany({
          where,
          orderBy,
          skip,
          take: limit
        }),
        prisma.galleryMedia.count({ where })
      ])

      // Format response
      const formattedItems = items.map(formatGalleryItem)
      const pagination = buildPaginationMeta(page, limit, total)

      console.log('[Gallery] Fetched items:', {
        total,
        page,
        limit,
        returned: items.length,
        filters: { category, featured, search }
      })

      res.json({
        success: true,
        data: {
          items: formattedItems,
          pagination
        }
      })
    } catch (error) {
      console.error('[Gallery] Error fetching gallery:', error)
      res.status(500).json(
        formatErrorResponse(
          'Failed to fetch gallery',
          error.message,
          'FETCH_ERROR'
        )
      )
    }
  }
)

/**
 * GET /api/gallery/featured - Featured gallery items
 * 
 * Fetch featured media items for gallery teaser section.
 * Results are cached for 5 minutes for optimal performance.
 * 
 * @returns {Object} 200 - Featured gallery items
 * @returns {Object} 429 - Rate limit exceeded
 * @returns {Object} 500 - Server error
 */
router.get(
  '/featured',
  publicRateLimiter,
  async (req, res) => {
    try {
      // Check cache
      const now = Date.now()
      if (
        featuredCache.data && 
        featuredCache.timestamp &&
        (now - featuredCache.timestamp) < featuredCache.ttl
      ) {
        console.log('[Gallery] Serving featured items from cache')
        return res
          .set('X-Cache', 'HIT')
          .json(featuredCache.data)
      }

      // Fetch featured items
      const items = await prisma.galleryMedia.findMany({
        where: {
          featured: true,
          deletedAt: null
        },
        orderBy: {
          displayOrder: 'asc'
        },
        take: 10 // Limit to 10 featured items
      })

      const formattedItems = items.map(formatGalleryItem)
      const response = formatSuccessResponse({ items: formattedItems })

      // Update cache
      featuredCache = {
        data: response,
        timestamp: now,
        ttl: featuredCache.ttl
      }

      console.log('[Gallery] Fetched and cached featured items:', items.length)

      res
        .set('X-Cache', 'MISS')
        .set('Cache-Control', 'public, max-age=300') // Browser cache for 5 minutes
        .json(response)
    } catch (error) {
      console.error('[Gallery] Error fetching featured items:', error)
      res.status(500).json(
        formatErrorResponse(
          'Failed to fetch featured items',
          error.message,
          'FETCH_FEATURED_ERROR'
        )
      )
    }
  }
)

/**
 * GET /api/gallery/:id - Single media item
 * 
 * Fetch a single media item by ID.
 * 
 * @param {string} id - Media item UUID
 * 
 * @returns {Object} 200 - Media item details
 * @returns {Object} 400 - Invalid ID format
 * @returns {Object} 404 - Media not found
 * @returns {Object} 429 - Rate limit exceeded
 * @returns {Object} 500 - Server error
 */
router.get(
  '/:id',
  publicRateLimiter,
  validateGalleryById,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params

      const item = await prisma.galleryMedia.findFirst({
        where: {
          id,
          deletedAt: null
        }
      })

      if (!item) {
        return res.status(404).json(
          formatErrorResponse(
            'Media not found',
            `No media item found with ID: ${id}`,
            'NOT_FOUND'
          )
        )
      }

      const formattedItem = formatGalleryItem(item)

      console.log('[Gallery] Fetched media item:', { id, filename: item.filename })

      res.json(formatSuccessResponse(formattedItem))
    } catch (error) {
      console.error('[Gallery] Error fetching media item:', error)
      res.status(500).json(
        formatErrorResponse(
          'Failed to fetch media item',
          error.message,
          'FETCH_ITEM_ERROR'
        )
      )
    }
  }
)

/**
 * POST /api/gallery - Upload media (Admin only)
 * 
 * Upload new media file with metadata.
 * Automatically processes image/video, generates variants, and uploads to R2.
 * 
 * @body {File} file - Media file (image or video)
 * @body {string} [title] - Media title
 * @body {string} [caption] - Media caption
 * @body {string} [alt] - Alt text for accessibility
 * @body {string} [category] - Media category
 * @body {boolean} [featured=false] - Featured status
 * @body {number} [displayOrder=0] - Display order
 * @body {string} [location] - Location where media was taken
 * @body {string} [photographer] - Photographer name
 * @body {string} [dateTaken] - Date when media was taken (ISO 8601)
 * 
 * @returns {Object} 201 - Media uploaded successfully
 * @returns {Object} 400 - Invalid file or metadata
 * @returns {Object} 413 - File too large
 * @returns {Object} 429 - Upload limit exceeded
 * @returns {Object} 500 - Server error
 */
router.post(
  '/',
  authenticateAdmin,
  uploadRateLimiter,
  uploadGalleryMedia,
  handleUploadError,
  validateFileSize,
  validateGalleryUpload,
  handleValidationErrors,
  async (req, res) => {
    try {
      const file = req.file
      const metadata = {
        title: req.body.title || null,
        caption: req.body.caption || null,
        alt: req.body.alt || file.originalname,
        category: req.body.category || null,
        featured: req.body.featured === 'true' || req.body.featured === true,
        displayOrder: Number.parseInt(req.body.displayOrder, 10) || 0,
        location: req.body.location || null,
        photographer: req.body.photographer || null,
        dateTaken: req.body.dateTaken ? new Date(req.body.dateTaken) : null
      }

      console.log('[Gallery] Processing upload:', {
        filename: file.originalname,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        type: file.mimetype,
        metadata
      })

      // Process upload through gallery media service
      const uploadResult = await galleryMediaService.uploadMedia(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        },
        metadata
      )
      
      // Create database record
      const mediaItem = await galleryMediaService.createMediaRecord(uploadResult, metadata)

      // Clear featured cache if this is a featured item
      if (metadata.featured) {
        featuredCache.data = null
        console.log('[Gallery] Cleared featured cache due to new featured item')
      }

      console.log('[Gallery] Upload successful:', {
        id: mediaItem.id,
        filename: mediaItem.filename,
        r2ObjectKey: mediaItem.r2ObjectKey
      })

      res.status(201).json(formatSuccessResponse(formatGalleryItem(mediaItem)))
    } catch (error) {
      console.error('[Gallery] Upload error:', error)
      res.status(500).json(
        formatErrorResponse(
          'Upload failed',
          error.message,
          'UPLOAD_ERROR'
        )
      )
    }
  }
)

/**
 * PUT /api/gallery/:id - Update media metadata (Admin only)
 * 
 * Update media item metadata. Does not update the file itself.
 * 
 * @param {string} id - Media item UUID
 * @body {string} [title] - Media title
 * @body {string} [caption] - Media caption
 * @body {string} [alt] - Alt text
 * @body {string} [category] - Media category
 * @body {boolean} [featured] - Featured status
 * @body {number} [displayOrder] - Display order
 * @body {string} [location] - Location
 * @body {string} [photographer] - Photographer
 * @body {string} [dateTaken] - Date taken (ISO 8601)
 * 
 * @returns {Object} 200 - Media updated successfully
 * @returns {Object} 400 - Invalid data
 * @returns {Object} 404 - Media not found
 * @returns {Object} 429 - Rate limit exceeded
 * @returns {Object} 500 - Server error
 */
router.put(
  '/:id',
  authenticateAdmin,
  adminRateLimiter,
  validateGalleryUpdate,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params
      const updateData = {}

      // Only include fields that were provided
      const allowedFields = [
        'title', 'caption', 'alt', 'category', 'featured',
        'displayOrder', 'location', 'photographer', 'dateTaken'
      ]

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field]
        }
      }

      // Check if media exists and not deleted
      const existingMedia = await prisma.galleryMedia.findFirst({
        where: {
          id,
          deletedAt: null
        }
      })

      if (!existingMedia) {
        return res.status(404).json(
          formatErrorResponse(
            'Media not found',
            `No media item found with ID: ${id}`,
            'NOT_FOUND'
          )
        )
      }

      // Update media
      const updatedMedia = await prisma.galleryMedia.update({
        where: { id },
        data: updateData
      })

      // Clear featured cache if featured status changed
      if (updateData.featured !== undefined) {
        featuredCache.data = null
        console.log('[Gallery] Cleared featured cache due to featured status change')
      }

      console.log('[Gallery] Updated media:', {
        id,
        updatedFields: Object.keys(updateData)
      })

      res.json(formatSuccessResponse(formatGalleryItem(updatedMedia)))
    } catch (error) {
      console.error('[Gallery] Update error:', error)
      res.status(500).json(
        formatErrorResponse(
          'Update failed',
          error.message,
          'UPDATE_ERROR'
        )
      )
    }
  }
)

/**
 * DELETE /api/gallery/:id - Delete media (Admin only)
 * 
 * Soft delete by default (sets deletedAt timestamp).
 * Use ?permanent=true for hard delete (removes from R2 and database).
 * 
 * @param {string} id - Media item UUID
 * @query {boolean} [permanent=false] - Hard delete flag
 * 
 * @returns {Object} 200 - Media deleted successfully
 * @returns {Object} 400 - Invalid ID
 * @returns {Object} 404 - Media not found
 * @returns {Object} 429 - Rate limit exceeded
 * @returns {Object} 500 - Server error
 */
router.delete(
  '/:id',
  authenticateAdmin,
  adminRateLimiter,
  validateGalleryDelete,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params
      const permanent = req.query.permanent === 'true'

      // Check if media exists
      const media = await prisma.galleryMedia.findUnique({
        where: { id }
      })

      if (!media) {
        return res.status(404).json(
          formatErrorResponse(
            'Media not found',
            `No media item found with ID: ${id}`,
            'NOT_FOUND'
          )
        )
      }

      if (permanent) {
        // Hard delete: Remove from R2 and database
        await galleryMediaService.deleteMedia(id, true)
        
        console.log('[Gallery] Permanently deleted media:', {
          id,
          filename: media.filename,
          r2ObjectKey: media.r2ObjectKey
        })

        res.json({
          success: true,
          message: 'Media permanently deleted',
          data: { id, deleted: true, permanent: true }
        })
      } else {
        // Soft delete: Set deletedAt timestamp
        const deletedMedia = await prisma.galleryMedia.update({
          where: { id },
          data: { deletedAt: new Date() }
        })

        console.log('[Gallery] Soft deleted media:', {
          id,
          filename: media.filename
        })

        res.json({
          success: true,
          message: 'Media soft deleted',
          data: { id, deleted: true, permanent: false, deletedAt: deletedMedia.deletedAt }
        })
      }

      // Clear featured cache if deleted item was featured
      if (media.featured) {
        featuredCache.data = null
        console.log('[Gallery] Cleared featured cache due to deletion')
      }
    } catch (error) {
      console.error('[Gallery] Delete error:', error)
      res.status(500).json(
        formatErrorResponse(
          'Delete failed',
          error.message,
          'DELETE_ERROR'
        )
      )
    }
  }
)

/**
 * PUT /api/gallery/reorder - Bulk reorder media (Admin only)
 * 
 * Update display order for multiple media items atomically.
 * All items must exist or the entire operation fails.
 * 
 * @body {Array} items - Array of {id, displayOrder} objects
 * 
 * @returns {Object} 200 - Media reordered successfully
 * @returns {Object} 400 - Invalid data
 * @returns {Object} 404 - One or more media items not found
 * @returns {Object} 429 - Rate limit exceeded
 * @returns {Object} 500 - Server error
 */
router.put(
  '/reorder',
  authenticateAdmin,
  adminRateLimiter,
  validateGalleryReorder,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { items } = req.body

      // Verify all items exist
      const ids = items.map(item => item.id)
      const existingItems = await prisma.galleryMedia.findMany({
        where: {
          id: { in: ids },
          deletedAt: null
        },
        select: { id: true }
      })

      if (existingItems.length !== ids.length) {
        const foundIds = new Set(existingItems.map(item => item.id))
        const missingIds = ids.filter(id => !foundIds.has(id))
        
        return res.status(404).json(
          formatErrorResponse(
            'Media items not found',
            `Could not find media items with IDs: ${missingIds.join(', ')}`,
            'NOT_FOUND',
            { missingIds }
          )
        )
      }

      // Perform atomic bulk update
      const updates = items.map(item =>
        prisma.galleryMedia.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder }
        })
      )

      await prisma.$transaction(updates)

      console.log('[Gallery] Reordered media items:', {
        count: items.length,
        items: items.map(i => ({ id: i.id, order: i.displayOrder }))
      })

      res.json({
        success: true,
        message: 'Media items reordered successfully',
        data: {
          updated: items.length,
          items: items.map(i => ({ id: i.id, displayOrder: i.displayOrder }))
        }
      })
    } catch (error) {
      console.error('[Gallery] Reorder error:', error)
      res.status(500).json(
        formatErrorResponse(
          'Reorder failed',
          error.message,
          'REORDER_ERROR'
        )
      )
    }
  }
)

export default router
