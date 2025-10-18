/**
 * RSVP Routes
 * 
 * REST API endpoints for RSVP management with validation and rate limiting.
 * 
 * @module routes/rsvp
 */

import express from 'express'
import rateLimit from 'express-rate-limit'
import { 
  createRSVP, 
  getRSVPsByVenue, 
  getRSVPStats,
  getRSVPById,
  updateRSVP,
  deleteRSVP,
  getRSVPsWithPagination
} from '../services/rsvpService.js'
import { 
  validateCreateRSVP,
  validateUpdateRSVP, 
  checkValidationResult,
  rsvpRateLimitConfig,
  adminRateLimitConfig 
} from '../utils/rsvpValidation.js'

const router = express.Router()

/**
 * Rate limiter for RSVP submissions
 */
const rsvpRateLimiter = rateLimit(rsvpRateLimitConfig)

/**
 * Rate limiter for admin operations
 */
const adminRateLimiter = rateLimit(adminRateLimitConfig)

/**
 * POST /api/rsvp - Create new RSVP submission
 * 
 * Supports both personalized (with guestId) and non-personalized RSVPs.
 * Implements duplicate prevention by updating existing RSVP.
 * 
 * @body {string} [guestId] - Optional guest UUID for personalized RSVPs
 * @body {string} name - Guest name (2-100 characters)
 * @body {number} guestCount - Number of guests (1-10)
 * @body {boolean} willAttend - Attendance confirmation
 * @body {string} [wishes] - Optional wishes message (10-500 characters)
 * @body {string} venue - Venue ('hue' or 'hanoi')
 * @body {string} [honeypot] - Honeypot field for spam prevention (must be empty)
 * 
 * @returns {Object} 201 - RSVP created successfully
 * @returns {Object} 400 - Validation error
 * @returns {Object} 404 - Guest not found (if guestId provided)
 * @returns {Object} 429 - Too many requests
 * @returns {Object} 500 - Server error
 */
router.post(
  '/',
  rsvpRateLimiter,
  validateCreateRSVP,
  checkValidationResult,
  async (req, res) => {
    try {
      const { guestId, name, guestCount, willAttend, wishes, venue, honeypot } = req.body

      // Honeypot check (additional layer beyond validation)
      if (honeypot && honeypot.trim() !== '') {
        console.warn('🤖 Bot detected via honeypot field')
        return res.status(400).json({
          success: false,
          error: 'Invalid request'
        })
      }

      // Create RSVP via service layer
      const rsvp = await createRSVP({
        guestId,
        name,
        guestCount,
        willAttend,
        wishes,
        venue
      })

      // Determine if this was an update or new creation
      const isUpdate = rsvp.updatedAt > rsvp.createdAt

      console.log(`✅ RSVP ${isUpdate ? 'updated' : 'created'}:`, {
        id: rsvp.id,
        name: rsvp.name,
        venue: rsvp.venue,
        willAttend: rsvp.willAttend,
        guestCount: rsvp.guestCount,
        hasGuestId: !!rsvp.guestId
      })

      res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: isUpdate 
          ? 'RSVP đã được cập nhật thành công' 
          : 'RSVP đã được gửi thành công',
        data: {
          id: rsvp.id,
          name: rsvp.name,
          guestCount: rsvp.guestCount,
          willAttend: rsvp.willAttend,
          venue: rsvp.venue,
          wishes: rsvp.wishes,
          createdAt: rsvp.createdAt,
          updatedAt: rsvp.updatedAt,
          isUpdate
        }
      })
    } catch (error) {
      console.error('❌ RSVP creation error:', error)

      // Handle specific error cases
      if (error.message === 'Guest not found') {
        return res.status(404).json({
          success: false,
          error: 'Không tìm thấy khách mời',
          details: {
            guestId: 'Guest ID không tồn tại trong hệ thống'
          }
        })
      }

      // Generic error response
      res.status(500).json({
        success: false,
        error: 'Có lỗi xảy ra khi gửi RSVP. Vui lòng thử lại sau.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
)

/**
 * GET /api/rsvp/venue/:venue - Get all RSVPs for a specific venue
 * 
 * @param {string} venue - Venue filter ('hue' or 'hanoi')
 * @returns {Object} 200 - List of RSVPs
 * @returns {Object} 400 - Invalid venue
 * @returns {Object} 500 - Server error
 */
router.get('/venue/:venue', async (req, res) => {
  try {
    const { venue } = req.params

    // Validate venue parameter
    if (!['hue', 'hanoi'].includes(venue)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid venue. Must be "hue" or "hanoi"'
      })
    }

    const rsvps = await getRSVPsByVenue(venue)

    res.json({
      success: true,
      data: {
        venue,
        count: rsvps.length,
        rsvps
      }
    })
  } catch (error) {
    console.error('❌ Get RSVPs error:', error)

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve RSVPs',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/rsvp/stats/:venue - Get RSVP statistics for a venue
 * 
 * @param {string} venue - Venue filter ('hue' or 'hanoi')
 * @returns {Object} 200 - RSVP statistics
 * @returns {Object} 400 - Invalid venue
 * @returns {Object} 500 - Server error
 */
router.get('/stats/:venue', async (req, res) => {
  try {
    const { venue } = req.params

    // Validate venue parameter
    if (!['hue', 'hanoi'].includes(venue)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid venue. Must be "hue" or "hanoi"'
      })
    }

    const stats = await getRSVPStats(venue)

    res.json({
      success: true,
      data: {
        venue,
        ...stats
      }
    })
  } catch (error) {
    console.error('❌ Get RSVP stats error:', error)

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve RSVP statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/rsvp - Get all RSVPs with pagination, filtering, and search
 * 
 * Query parameters:
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 * @query {string} [venue] - Filter by venue ('hue' or 'hanoi')
 * @query {string} [willAttend] - Filter by attendance ('true' or 'false')
 * @query {string} [search] - Search by guest name
 * @query {string} [sortBy='createdAt'] - Sort field (createdAt, name, guestCount)
 * @query {string} [sortOrder='desc'] - Sort order (asc or desc)
 * 
 * @returns {Object} 200 - Paginated RSVP list with metadata
 * @returns {Object} 400 - Invalid query parameters
 * @returns {Object} 500 - Server error
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      venue,
      willAttend,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query

    // Parse and validate pagination parameters
    const parsedPage = Number.parseInt(page, 10)
    const parsedLimit = Number.parseInt(limit, 10)

    if (Number.isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid page parameter. Must be a positive integer.'
      })
    }

    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter. Must be between 1 and 100.'
      })
    }

    // Parse willAttend boolean
    let parsedWillAttend
    if (willAttend !== undefined) {
      if (willAttend === 'true') {
        parsedWillAttend = true
      } else if (willAttend === 'false') {
        parsedWillAttend = false
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid willAttend parameter. Must be "true" or "false".'
        })
      }
    }

    // Validate venue if provided
    if (venue && !['hue', 'hanoi'].includes(venue)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid venue parameter. Must be "hue" or "hanoi".'
      })
    }

    // Validate sortBy
    const allowedSortFields = ['createdAt', 'name', 'guestCount', 'updatedAt']
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        error: `Invalid sortBy parameter. Must be one of: ${allowedSortFields.join(', ')}`
      })
    }

    // Validate sortOrder
    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sortOrder parameter. Must be "asc" or "desc".'
      })
    }

    console.log('📋 Fetching RSVPs with filters:', {
      page: parsedPage,
      limit: parsedLimit,
      venue,
      willAttend: parsedWillAttend,
      search,
      sortBy,
      sortOrder
    })

    const result = await getRSVPsWithPagination({
      page: parsedPage,
      limit: parsedLimit,
      venue,
      willAttend: parsedWillAttend,
      search,
      sortBy,
      sortOrder
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('❌ Get RSVPs error:', error)

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve RSVPs',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/rsvp/:id - Get RSVP by ID
 * 
 * @param {string} id - RSVP UUID
 * @returns {Object} 200 - RSVP record
 * @returns {Object} 404 - RSVP not found
 * @returns {Object} 500 - Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const rsvp = await getRSVPById(id)

    if (!rsvp) {
      return res.status(404).json({
        success: false,
        error: 'RSVP not found'
      })
    }

    res.json({
      success: true,
      data: rsvp
    })
  } catch (error) {
    console.error('❌ Get RSVP by ID error:', error)

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve RSVP',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * PATCH /api/rsvp/:id - Update RSVP
 * 
 * Update an existing RSVP with partial data. All fields are optional.
 * 
 * @param {string} id - RSVP UUID
 * @body {string} [name] - Updated guest name (2-100 characters)
 * @body {number} [guestCount] - Updated guest count (1-10)
 * @body {boolean} [willAttend] - Updated attendance status
 * @body {string} [wishes] - Updated wishes message (max 500 characters)
 * @body {string} [venue] - Updated venue ('hue' or 'hanoi')
 * 
 * @returns {Object} 200 - RSVP updated successfully
 * @returns {Object} 400 - Validation error or business rule violation
 * @returns {Object} 404 - RSVP not found
 * @returns {Object} 429 - Too many requests
 * @returns {Object} 500 - Server error
 */
router.patch(
  '/:id',
  adminRateLimiter,
  validateUpdateRSVP,
  checkValidationResult,
  async (req, res) => {
    try {
      const { id } = req.params
      const updateData = req.body

      console.log('🔄 Updating RSVP:', { id, updateData })

      const updatedRSVP = await updateRSVP(id, updateData)

      console.log('✅ RSVP updated successfully:', updatedRSVP.id)

      res.json({
        success: true,
        data: updatedRSVP,
        message: 'RSVP updated successfully'
      })
    } catch (error) {
      console.error('❌ Update RSVP error:', error)

      if (error.message === 'RSVP not found') {
        return res.status(404).json({
          success: false,
          error: 'RSVP not found'
        })
      }

      if (error.message.includes('venue')) {
        return res.status(400).json({
          success: false,
          error: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update RSVP',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
)

/**
 * DELETE /api/rsvp/:id - Delete RSVP
 * 
 * Permanently remove an RSVP from the database.
 * 
 * @param {string} id - RSVP UUID
 * 
 * @returns {Object} 200 - RSVP deleted successfully
 * @returns {Object} 404 - RSVP not found
 * @returns {Object} 429 - Too many requests
 * @returns {Object} 500 - Server error
 */
router.delete(
  '/:id',
  adminRateLimiter,
  async (req, res) => {
    try {
      const { id } = req.params

      console.log('🗑️  Deleting RSVP:', id)

      const deletedRSVP = await deleteRSVP(id)

      console.log('✅ RSVP deleted successfully:', deletedRSVP.name)

      res.json({
        success: true,
        message: 'RSVP deleted successfully',
        data: {
          id: deletedRSVP.id,
          name: deletedRSVP.name,
          venue: deletedRSVP.venue
        }
      })
    } catch (error) {
      console.error('❌ Delete RSVP error:', error)

      if (error.message === 'RSVP not found') {
        return res.status(404).json({
          success: false,
          error: 'RSVP not found'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete RSVP',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
)

export default router
