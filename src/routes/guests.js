/**
 * Guest Management Routes
 * 
 * REST API endpoints for CRUD operations on guests with image upload support
 */

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { getPrismaClient } from '../utils/database.js'
import { uploadMultiple, handleUploadError } from '../middleware/upload.js'
import { imageService } from '../services/imageService.js'

const router = express.Router()

/**
 * Validation Rules
 */
const validateCreateGuest = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên từ 2-100 ký tự'),
  
  body('venue')
    .isIn(['hue', 'hanoi'])
    .withMessage('Địa điểm hoặc "hue" hoặc "hanoi"'),
  
  body('secondaryNote')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Secondary note must be under 200 characters'),
]

const validateUpdateGuest = [
  param('id').isUUID().withMessage('Invalid guest ID format'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2-100 characters'),
  
  body('venue')
    .optional()
    .isIn(['hue', 'hanoi'])
    .withMessage('Venue must be either "hue" or "hanoi"'),
  
  body('secondaryNote')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Secondary note must be under 200 characters'),
]

/**
 * POST /api/guests - Create new guest with optional image upload
 * 
 * Supports multipart/form-data with:
 * - name (required)
 * - venue (required)
 * - secondaryNote (optional)
 * - invitationImageFront (optional file)
 * - invitationImageMain (optional file)
 * 
 * Uses 2-phase approach: Create guest first, then upload images.
 * If image upload fails, guest record remains valid (graceful degradation).
 */
router.post(
  '/',
  uploadMultiple,
  validateCreateGuest,
  async (req, res, next) => {
    try {
    // Log detailed request information for debugging
    console.log('🔍 [POST /api/guests] Request received from:', req.headers['user-agent'])
    console.log('🔍 [POST /api/guests] Origin:', req.headers.origin)
    console.log('🔍 [POST /api/guests] Content-Type:', req.headers['content-type'])
    console.log('🔍 [POST /api/guests] Request body fields:', Object.keys(req.body))
    console.log('🔍 [POST /api/guests] Files received:', req.files ? Object.keys(req.files) : 'none')
    
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      console.error('❌ [POST /api/guests] Validation failed:', errors.array())
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array(),
        },
      })
    }

    const prisma = getPrismaClient()
    const { name, venue, secondaryNote } = req.body

    // PHASE 1: Create guest record first (always succeeds)
    const guest = await prisma.guest.create({
      data: {
        name,
        venue,
        secondaryNote: secondaryNote || null,
        invitationUrl: '', // Temporary placeholder
        invitationImageFrontUrl: null,
        invitationImageMainUrl: null,
      },
    })

    // Generate unique invitation URL using the guest ID
    const baseUrl = process.env.FRONTEND_URL || 'https://ngocquanwd.com'
    const venueSlug = venue === 'hue' ? 'hue' : 'hn'
    const invitationUrl = `${baseUrl}/${venueSlug}/${guest.id}`

    console.log(`✅ Guest created: ${guest.id} - ${guest.name}`)
    console.log(`📨 Invitation URL: ${invitationUrl}`)

    // PHASE 2: Try to upload images (graceful degradation on failure)
    const imageUrls = {
      invitationImageFrontUrl: null,
      invitationImageMainUrl: null
    }

    const imageUploadWarnings = []

    // Check if image service is configured
    if (!imageService.isConfigured()) {
      console.warn('⚠️ Image service not configured - skipping image upload')
      imageUploadWarnings.push('Image storage not configured')
    } else if (req.files) {
      // Upload front image if provided
      if (req.files.invitationImageFront && req.files.invitationImageFront[0]) {
        try {
          const frontFile = req.files.invitationImageFront[0]
          const frontUrl = await imageService.uploadImage(frontFile, guest.id, venue, 'front')
          imageUrls.invitationImageFrontUrl = frontUrl
          console.log(`✅ Front image uploaded: ${frontUrl}`)
        } catch (error) {
          console.error('❌ Front image upload failed:', error.message)
          imageUploadWarnings.push(`Front image upload failed: ${error.message}`)
        }
      }

      // Upload main image if provided
      if (req.files.invitationImageMain && req.files.invitationImageMain[0]) {
        try {
          const mainFile = req.files.invitationImageMain[0]
          const mainUrl = await imageService.uploadImage(mainFile, guest.id, venue, 'main')
          imageUrls.invitationImageMainUrl = mainUrl
          console.log(`✅ Main image uploaded: ${mainUrl}`)
        } catch (error) {
          console.error('❌ Main image upload failed:', error.message)
          imageUploadWarnings.push(`Main image upload failed: ${error.message}`)
        }
      }
    }

    // Update guest with invitation URL and image URLs (if any)
    const updatedGuest = await prisma.guest.update({
      where: { id: guest.id },
      data: {
        invitationUrl,
        ...imageUrls
      },
    })

    // Build response
    const response = {
      success: true,
      data: updatedGuest,
    }

    // Add warnings if image upload failed
    if (imageUploadWarnings.length > 0) {
      response.warnings = imageUploadWarnings
      response.message = 'Guest created successfully, but some images failed to upload'
    }

    res.status(201).json(response)
  } catch (error) {
    console.error('Error creating guest:', error)
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create guest',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    })
  }
})

/**
 * GET /api/guests - List all guests with pagination
 * Note: This must come BEFORE /:id route to avoid path conflicts
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
  query('venue').optional().isIn(['hue', 'hanoi']).withMessage('Invalid venue filter'),
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid query parameters',
          details: errors.array(),
        },
      })
    }

    const prisma = getPrismaClient()
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const venue = req.query.venue
    const skip = (page - 1) * limit

    // Build filter
    const where = venue ? { venue } : {}

    // Get total count
    const total = await prisma.guest.count({ where })

    // Get paginated results
    const guests = await prisma.guest.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    })

    res.status(200).json({
      success: true,
      data: guests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + guests.length < total,
      },
    })
  } catch (error) {
    console.error('Error listing guests:', error)
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list guests',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    })
  }
})

/**
 * GET /api/guests/:id - Get guest by ID
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid guest ID format'),
], async (req, res) => {
  try {
    // Log detailed request information for debugging
    console.log('🔍 [GET /api/guests/:id] Request received from:', req.headers['user-agent'])
    console.log('🔍 [GET /api/guests/:id] Origin:', req.headers.origin)
    console.log('🔍 [GET /api/guests/:id] Guest ID:', req.params.id)
    
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      console.error('❌ [GET /api/guests/:id] Validation failed:', errors.array())
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid guest ID',
          details: errors.array(),
        },
      })
    }

    const prisma = getPrismaClient()
    const { id } = req.params

    const guest = await prisma.guest.findUnique({
      where: { id },
    })

    if (!guest) {
      console.warn('⚠️ [GET /api/guests/:id] Guest not found:', id)
      return res.status(404).json({
        success: false,
        error: {
          message: 'Guest not found',
          guestId: id,
        },
      })
    }

    console.log('✅ [GET /api/guests/:id] Guest found:', guest.name)
    res.status(200).json({
      success: true,
      data: guest,
    })
  } catch (error) {
    console.error('❌ [GET /api/guests/:id] Error fetching guest:', error)
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch guest',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    })
  }
})

/**
 * PATCH /api/guests/:id - Update guest
 */
router.patch('/:id', validateUpdateGuest, async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array(),
        },
      })
    }

    const prisma = getPrismaClient()
    const { id } = req.params
    const updates = {}

    // Only include provided fields
    if (req.body.name !== undefined) updates.name = req.body.name
    if (req.body.venue !== undefined) updates.venue = req.body.venue
    if (req.body.secondaryNote !== undefined) updates.secondaryNote = req.body.secondaryNote
    if (req.body.invitationImageFrontUrl !== undefined) updates.invitationImageFrontUrl = req.body.invitationImageFrontUrl
    if (req.body.invitationImageMainUrl !== undefined) updates.invitationImageMainUrl = req.body.invitationImageMainUrl

    // Check if guest exists
    const exists = await prisma.guest.findUnique({ where: { id } })
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Guest not found',
          guestId: id,
        },
      })
    }

    // Update guest
    const guest = await prisma.guest.update({
      where: { id },
      data: updates,
    })

    console.log(`✅ Guest updated: ${guest.id}`)

    res.status(200).json({
      success: true,
      data: guest,
    })
  } catch (error) {
    console.error('Error updating guest:', error)
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update guest',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    })
  }
})

/**
 * DELETE /api/guests/:id - Delete guest and associated images
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid guest ID format'),
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid guest ID',
          details: errors.array(),
        },
      })
    }

    const prisma = getPrismaClient()
    const { id } = req.params

    // Check if guest exists and get image URLs
    const guest = await prisma.guest.findUnique({ where: { id } })
    if (!guest) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Guest not found',
          guestId: id,
        },
      })
    }

    // Delete associated images from R2 (if any)
    const imageUrls = [
      guest.invitationImageFrontUrl,
      guest.invitationImageMainUrl
    ].filter(Boolean)

    if (imageUrls.length > 0) {
      console.log(`🗑️ Deleting ${imageUrls.length} image(s) for guest ${id}...`)
      await imageService.deleteImages(imageUrls)
    }

    // Delete guest record from database
    await prisma.guest.delete({
      where: { id },
    })

    console.log(`✅ Guest deleted: ${id}`)

    res.status(200).json({
      success: true,
      data: {
        message: 'Guest deleted successfully',
        guestId: id,
      },
    })
  } catch (error) {
    console.error('Error deleting guest:', error)
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete guest',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    })
  }
})

export default router
