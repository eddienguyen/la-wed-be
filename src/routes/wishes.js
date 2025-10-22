/**
 * Wishes Routes
 * 
 * REST API endpoint for fetching wishes from RSVP submissions.
 * Provides filtered, paginated access to non-empty wishes with rate limiting.
 * 
 * @module routes/wishes
 */

import express from 'express'
import rateLimit from 'express-rate-limit'
import { query, validationResult } from 'express-validator'
import { getWishesData } from '../services/rsvpService.js'

const router = express.Router()

/**
 * Rate limiting configuration for wishes endpoint
 * 
 * More lenient than RSVP submissions as this is read-only.
 */
const wishesRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests for wishes data. Please try again later.',
    retryAfter: 900 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
}

/**
 * Rate limiter for wishes endpoint
 */
const wishesRateLimiter = rateLimit(wishesRateLimitConfig)

/**
 * Validation rules for wishes query parameters
 */
const validateWishesQuery = [
  // Limit - optional integer between 1-50, default 10
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),

  // Venue - optional, must be hue or hanoi
  query('venue')
    .optional()
    .isIn(['hue', 'hanoi'])
    .withMessage('Venue must be "hue" or "hanoi"'),

  // Page - optional integer, minimum 1, default 1
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt()
]

/**
 * Middleware to check validation results
 */
const checkValidationResult = (req, res, next) => {
  const errors = validationResult(req)
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid query parameters',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    })
  }
  
  next()
}

/**
 * GET /api/wishes - Fetch wishes data
 * 
 * Returns paginated list of wishes from RSVP submissions.
 * Only includes RSVPs with non-empty wishes field.
 * 
 * @query {number} [limit=10] - Number of wishes to return (1-50)
 * @query {string} [venue] - Filter by venue ('hue' or 'hanoi')
 * @query {number} [page=1] - Page number for pagination
 * 
 * @returns {Object} 200 - Wishes data with pagination
 * @returns {Object} 400 - Invalid query parameters
 * @returns {Object} 429 - Too many requests
 * @returns {Object} 500 - Server error
 * 
 * @example
 * GET /api/wishes?limit=10&venue=hue&page=1
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "wishes": [
 *       {
 *         "id": "uuid",
 *         "name": "Guest Name",
 *         "wishes": "Wish content",
 *         "createdAt": "2025-10-20T10:30:00Z",
 *         "venue": "hue"
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 10,
 *       "total": 25,
 *       "hasMore": true
 *     }
 *   }
 * }
 */
router.get(
  '/',
  wishesRateLimiter,
  validateWishesQuery,
  checkValidationResult,
  async (req, res) => {
    try {
      const { limit = 10, venue, page = 1 } = req.query

      console.log('📝 Fetching wishes:', { limit, venue, page })

      // Fetch wishes data from service
      const result = await getWishesData({
        limit: Number(limit),
        venue,
        page: Number(page)
      })

      console.log(`✅ Wishes fetched successfully:`, {
        count: result.wishes.length,
        total: result.pagination.totalCount,
        page: result.pagination.currentPage
      })

      res.status(200).json({
        success: true,
        data: result
      })

    } catch (error) {
      console.error('❌ Error fetching wishes:', error)

      // Handle specific error types
      if (error.message.includes('Database')) {
        return res.status(500).json({
          success: false,
          error: 'Database connection error. Please try again later.'
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch wishes data'
      })
    }
  }
)

export default router
