/**
 * Admin Routes Aggregator
 * 
 * Combines all admin-related routes into a single router.
 * 
 * @module routes/admin
 */

import express from 'express'
import statsRoutes from './stats.js'
import guestsRoutes from './guests.js'

const router = express.Router()

// Register admin sub-routes
router.use('/stats', statsRoutes)
router.use('/guests', guestsRoutes)

// Future admin routes can be added here:
// router.use('/rsvps', rsvpAdminRoutes)
// router.use('/auth', authRoutes)

export default router
