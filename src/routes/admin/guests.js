/**
 * Admin Guest Management Routes
 * 
 * Admin-specific endpoints for guest management with pagination,
 * filtering, sorting, and RSVP relationship checking.
 * 
 * @module routes/admin/guests
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { getPrismaClient } from '../../utils/database.js';

const router = express.Router();

/**
 * Validation Rules
 */
const validateGuestQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),
  
  query('sortBy')
    .optional()
    .isIn(['name', 'venue', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  query('venue')
    .optional()
    .isIn(['hue', 'hanoi'])
    .withMessage('Venue must be either hue or hanoi'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query too long'),
];

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
];

/**
 * GET /api/admin/guests - Get paginated guest list with filters
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (name, venue, createdAt, updatedAt)
 * - sortOrder: Sort direction (asc, desc)
 * - venue: Filter by venue (hue, hanoi)
 * - search: Search by name (case-insensitive partial match)
 */
router.get('/', validateGuestQuery, async (req, res) => {
  try {
    // Validate query params
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array(),
        },
      });
    }

    // Parse and validate pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Parse sorting
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build where clause
    const where = {};
    
    // Venue filter
    if (req.query.venue) {
      where.venue = req.query.venue;
    }
    
    // Search filter
    if (req.query.search) {
      where.name = {
        contains: req.query.search,
        mode: 'insensitive',
      };
    }

    // Get Prisma client
    const prisma = getPrismaClient();

    // Execute queries in parallel
    const [guests, totalCount] = await Promise.all([
      prisma.guest.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        select: {
          id: true,
          name: true,
          venue: true,
          secondaryNote: true,
          invitationUrl: true,
          invitationImageFrontUrl: true,
          invitationImageMainUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.guest.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    // Success response
    res.json({
      success: true,
      data: {
        guests,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasNext,
          hasPrevious,
        },
      },
    });

  } catch (error) {
    console.error('❌ [GET /api/admin/guests] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch guests',
        details: error.message,
      },
    });
  }
});

/**
 * PUT /api/admin/guests/:id - Update guest information
 * 
 * Updates basic guest information (name, venue, secondaryNote).
 * Does not handle invitation image updates (use /api/guests/:id for that).
 */
router.put('/:id', validateUpdateGuest, async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array(),
        },
      });
    }

    const { id } = req.params;
    const { name, venue, secondaryNote } = req.body;

    // Build update data (only include provided fields)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (venue !== undefined) updateData.venue = venue;
    if (secondaryNote !== undefined) updateData.secondaryNote = secondaryNote;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No valid fields to update',
        },
      });
    }

    // Get Prisma client
    const prisma = getPrismaClient();

    // Check if guest exists
    const existingGuest = await prisma.guest.findUnique({
      where: { id },
    });

    if (!existingGuest) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Guest not found',
        },
      });
    }

    // Update guest
    const updatedGuest = await prisma.guest.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        venue: true,
        secondaryNote: true,
        invitationUrl: true,
        invitationImageFrontUrl: true,
        invitationImageMainUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: updatedGuest,
    });

  } catch (error) {
    console.error('❌ [PUT /api/admin/guests/:id] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update guest',
        details: error.message,
      },
    });
  }
});

/**
 * DELETE /api/admin/guests/:id - Delete guest
 * 
 * Deletes a guest and all associated RSVPs (cascade).
 * Returns count of deleted RSVPs for confirmation.
 */
router.delete('/:id', param('id').isUUID(), async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array(),
        },
      });
    }

    const { id } = req.params;

    // Get Prisma client
    const prisma = getPrismaClient();

    // Check if guest exists and count RSVPs
    const [guest, rsvpCount] = await Promise.all([
      prisma.guest.findUnique({
        where: { id },
      }),
      prisma.rSVP.count({
        where: { guestId: id },
      }),
    ]);

    if (!guest) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Guest not found',
        },
      });
    }

    // Delete guest (RSVPs will cascade delete due to schema)
    await prisma.guest.delete({
      where: { id },
    });

    res.json({
      success: true,
      data: {
        message: 'Guest deleted successfully',
        deletedRSVPs: rsvpCount,
      },
    });

  } catch (error) {
    console.error('❌ [DELETE /api/admin/guests/:id] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete guest',
        details: error.message,
      },
    });
  }
});

/**
 * GET /api/admin/guests/:id/check-rsvps - Check if guest has RSVPs
 * 
 * Returns RSVP count and warning message for delete confirmation.
 */
router.get('/:id/check-rsvps', param('id').isUUID(), async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array(),
        },
      });
    }

    const { id } = req.params;

    // Get Prisma client
    const prisma = getPrismaClient();

    // Check if guest exists
    const guest = await prisma.guest.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Guest not found',
        },
      });
    }

    // Count RSVPs
    const rsvpCount = await prisma.rSVP.count({
      where: { guestId: id },
    });

    const hasRSVPs = rsvpCount > 0;

    res.json({
      success: true,
      data: {
        hasRSVPs,
        rsvpCount,
        message: hasRSVPs
          ? `Guest "${guest.name}" has ${rsvpCount} RSVP${rsvpCount > 1 ? 's' : ''} that will also be deleted.`
          : `Guest "${guest.name}" has no RSVPs.`,
      },
    });

  } catch (error) {
    console.error('❌ [GET /api/admin/guests/:id/check-rsvps] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to check RSVPs',
        details: error.message,
      },
    });
  }
});

export default router;
