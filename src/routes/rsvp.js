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
  getRSVPById 
} from '../services/rsvpService.js'
import { 
  validateCreateRSVP, 
  checkValidationResult,
  rsvpRateLimitConfig 
} from '../utils/rsvpValidation.js'

const router = express.Router()

/**
 * Rate limiter for RSVP submissions
 */
const rsvpRateLimiter = rateLimit(rsvpRateLimitConfig)

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
    console.log("GOGOGO")
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

export default router
