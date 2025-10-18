/**
 * Admin Statistics Routes
 * 
 * API endpoints for admin dashboard statistics and analytics.
 * 
 * @module routes/admin/stats
 */

import express from 'express'
import { getAdminStats } from '../../services/rsvpService.js'

const router = express.Router()

/**
 * GET /api/admin/stats - Get comprehensive admin dashboard statistics
 * 
 * Returns aggregated statistics including:
 * - Total guests and guests by venue
 * - Total RSVPs and RSVPs by venue
 * - Total attending guests (sum of guestCount where willAttend=true)
 * - Response rate (percentage of guests who RSVPed)
 * - Recent activity (RSVPs in last 7 days)
 * - Last updated timestamp
 * 
 * @returns {Object} 200 - Admin statistics
 * @returns {Object} 500 - Server error
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalGuests": 45,
 *     "guestsByVenue": {
 *       "hue": 25,
 *       "hanoi": 20
 *     },
 *     "totalRsvps": 38,
 *     "rsvpsByVenue": {
 *       "hue": 22,
 *       "hanoi": 16
 *     },
 *     "attendingGuests": 85,
 *     "responseRate": 84.4,
 *     "recentActivity": 12,
 *     "lastUpdated": "2025-10-18T10:30:00.000Z"
 *   }
 * }
 */
router.get('/', async (req, res) => {
  try {
    console.log('📊 Fetching admin statistics...')

    const stats = await getAdminStats()

    console.log('✅ Admin statistics retrieved:', {
      totalGuests: stats.totalGuests,
      totalRsvps: stats.totalRsvps,
      attendingGuests: stats.attendingGuests,
      responseRate: stats.responseRate
    })

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('❌ Get admin stats error:', error)

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

export default router
