/**
 * Public Routes Aggregator
 * 
 * Combines all public-facing routes (no authentication required).
 * 
 * @module routes/public
 */

import express from 'express';
import galleryRoutes from './gallery.js';

const router = express.Router();

// Register public sub-routes
router.use('/gallery', galleryRoutes);

// Future public routes can be added here:
// router.use('/events', eventRoutes);
// router.use('/rsvp', rsvpRoutes);

export default router;
