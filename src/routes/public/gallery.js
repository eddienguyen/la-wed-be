/**
 * Public Gallery Routes
 * 
 * Public-facing API endpoints for gallery media retrieval.
 * No authentication required - returns only published, non-deleted media.
 * 
 * @module routes/public/gallery
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/public/gallery
 * Get published gallery media with pagination
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - sortBy: Sort field - createdAt, displayOrder, dateTaken, updatedAt (default: displayOrder)
 * - sortOrder: asc or desc (default: asc for displayOrder, desc for others)
 * 
 * Response format:
 * {
 *   success: true,
 *   data: {
 *     items: [...gallery images],
 *     pagination: {
 *       page: 1,
 *       limit: 20,
 *       total: 100,
 *       totalPages: 5,
 *       hasMore: true
 *     }
 *   }
 * }
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'displayOrder',
      sortOrder,
    } = req.query;

    // Validate and parse pagination params
    const pageNum = Math.max(1, Number.parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10))); // Max 100 items per page
    const skip = (pageNum - 1) * limitNum;

    // Validate sortBy field
    const validSortFields = ['createdAt', 'displayOrder', 'dateTaken', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'displayOrder';

    // Determine sort order (default: asc for displayOrder, desc for date fields)
    let order = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : null;
    if (!order) {
      order = sortField === 'displayOrder' ? 'asc' : 'desc';
    }

    // Build where clause - only show non-deleted media
    const where = {
      deletedAt: null,
    };

    // Execute query with pagination
    const [items, totalCount] = await Promise.all([
      prisma.galleryMedia.findMany({
        where,
        orderBy: { [sortField]: order },
        take: limitNum,
        skip,
        select: {
          id: true,
          filename: true,
          alt: true,
          title: true,
          caption: true,
          mediaType: true,
          category: true,
          r2Urls: true,
          featured: true,
          displayOrder: true,
          metadata: true,
          location: true,
          photographer: true,
          dateTaken: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.galleryMedia.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasMore = pageNum < totalPages;

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages,
          hasMore,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching public gallery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gallery images',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/public/gallery/:id
 * Get single gallery media item by ID
 * 
 * Response format:
 * {
 *   success: true,
 *   data: {
 *     image: {...gallery image}
 *   }
 * }
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const image = await prisma.galleryMedia.findFirst({
      where: {
        id,
        deletedAt: null, // Only return non-deleted items
      },
      select: {
        id: true,
        filename: true,
        alt: true,
        title: true,
        caption: true,
        mediaType: true,
        category: true,
        r2Urls: true,
        featured: true,
        displayOrder: true,
        metadata: true,
        location: true,
        photographer: true,
        dateTaken: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found',
      });
    }

    res.json({
      success: true,
      data: {
        image,
      },
    });
  } catch (error) {
    console.error('Error fetching gallery image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gallery image',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

export default router;
