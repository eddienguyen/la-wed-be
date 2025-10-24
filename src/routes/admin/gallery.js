/**
 * Gallery Admin Routes
 * 
 * Routes for managing gallery media items including upload, reordering,
 * categorization, and bulk operations.
 * 
 * @module routes/admin/gallery
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/admin/gallery
 * Get all media items with optional filtering
 * 
 * Query params:
 * - category: Filter by category
 * - type: Filter by media type (image/video)
 * - featured: Filter by featured status (true/false)
 * - limit: Limit number of results
 * - offset: Offset for pagination
 */
router.get('/', async (req, res) => {
  try {
    const { category, type, featured, limit, offset } = req.query;
    
    const where = {
      deletedAt: null, // Exclude soft-deleted records
    };
    if (category) where.category = category;
    if (type) where.mediaType = type;
    if (featured !== undefined) where.featured = featured === 'true';
    
    const [mediaItems, totalCount] = await Promise.all([
      prisma.galleryMedia.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        take: limit ? Number.parseInt(limit, 10) : undefined,
        skip: offset ? Number.parseInt(offset, 10) : undefined,
      }),
      prisma.galleryMedia.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: {
        items: mediaItems,
        total: totalCount,
        limit: limit ? Number.parseInt(limit, 10) : totalCount,
        offset: offset ? Number.parseInt(offset, 10) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media items',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/gallery/reorder
 * Bulk update display order for media items
 * 
 * Request body:
 * {
 *   items: [
 *     { id: string, displayOrder: number, category?: string },
 *     ...
 *   ]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     updatedCount: number,
 *     items: [...updated media items]
 *   }
 * }
 */
router.put('/reorder', async (req, res) => {
  try {
    console.log('🔄 /api/admin/gallery/reorder called');
    console.log('📦 req.body:', JSON.stringify(req.body, null, 2));
    console.log('📦 req.body type:', typeof req.body);
    console.log('📦 items:', req.body.items);
    console.log('📦 items type:', typeof req.body.items);
    console.log('📦 items isArray:', Array.isArray(req.body.items));
    
    const { items } = req.body;
    
    // Validation
    if (!Array.isArray(items) || items.length === 0) {
      console.error('❌ Validation failed: items is not an array or is empty');
      return res.status(400).json({
        success: false,
        error: 'Invalid request: items array is required',
      });
    }
    
    // Validate each item
    const invalidItems = items.filter(
      item => !item.id || typeof item.displayOrder !== 'number'
    );
    
    if (invalidItems.length > 0) {
      console.error('❌ Validation failed: invalid items found:', invalidItems);
      return res.status(400).json({
        success: false,
        error: 'Invalid items: each item must have id and displayOrder',
      });
    }
    
    // Perform bulk update in a transaction
    const updatedItems = await prisma.$transaction(
      items.map(item =>
        prisma.galleryMedia.update({
          where: { id: item.id },
          data: {
            displayOrder: item.displayOrder,
            ...(item.category && { category: item.category }),
          },
        })
      )
    );
    
    res.json({
      success: true,
      data: {
        updatedCount: updatedItems.length,
        items: updatedItems,
      },
    });
  } catch (error) {
    console.error('Error reordering media:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'One or more media items not found',
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to reorder media items',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/gallery/quick-sort
 * Apply quick sort actions to selected media items
 * 
 * Request body:
 * {
 *   action: 'move-to-top' | 'move-to-bottom' | 'alphabetical-asc' | 'alphabetical-desc' | 'reset-to-upload',
 *   itemIds: string[],
 *   category?: string (for filtering context)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     updatedCount: number,
 *     items: [...updated media items]
 *   }
 * }
 */
router.post('/quick-sort', async (req, res) => {
  try {
    const { action, itemIds, category } = req.body;
    
    // Validation
    if (!action || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: action and itemIds are required',
      });
    }
    
    // Get all media items in the context (same category or all)
    const where = category ? { category, deletedAt: null } : { deletedAt: null };
    const allItems = await prisma.galleryMedia.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });
    
    const selectedItems = allItems.filter(item => itemIds.includes(item.id));
    const unselectedItems = allItems.filter(item => !itemIds.includes(item.id));
    
    let newOrder = [];
    
    switch (action) {
      case 'move-to-top':
        // Selected items first, then unselected
        newOrder = [...selectedItems, ...unselectedItems];
        break;
        
      case 'move-to-bottom':
        // Unselected items first, then selected
        newOrder = [...unselectedItems, ...selectedItems];
        break;
        
      case 'alphabetical-asc': {
        // Sort selected alphabetically ascending, keep unselected in place
        const sortedAsc = [...selectedItems].sort((a, b) => 
          a.filename.localeCompare(b.filename)
        );
        newOrder = allItems.map(item =>
          itemIds.includes(item.id)
            ? sortedAsc.shift()
            : item
        );
        break;
      }
        
      case 'alphabetical-desc': {
        // Sort selected alphabetically descending, keep unselected in place
        const sortedDesc = [...selectedItems].sort((a, b) => 
          b.filename.localeCompare(a.filename)
        );
        newOrder = allItems.map(item =>
          itemIds.includes(item.id)
            ? sortedDesc.shift()
            : item
        );
        break;
      }
        
      case 'reset-to-upload':
        // Sort by createdAt (upload date)
        newOrder = [...allItems].sort((a, b) => 
          new Date(a.createdAt) - new Date(b.createdAt)
        );
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: `Invalid action: ${action}`,
        });
    }
    
    // Recalculate display orders
    const updates = newOrder.map((item, index) => ({
      id: item.id,
      displayOrder: index,
    }));
    
    // Perform bulk update in a transaction
    const updatedItems = await prisma.$transaction(
      updates.map(update =>
        prisma.galleryMedia.update({
          where: { id: update.id },
          data: { displayOrder: update.displayOrder },
        })
      )
    );
    
    res.json({
      success: true,
      data: {
        updatedCount: updatedItems.length,
        items: updatedItems,
      },
    });
  } catch (error) {
    console.error('Error applying quick sort:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply quick sort',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/admin/gallery/:id
 * Update a single media item
 * 
 * Request body:
 * {
 *   category?: string,
 *   isFeatured?: boolean,
 *   displayOrder?: number,
 *   dateTaken?: string (ISO date)
 * }
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 PATCH /api/admin/gallery/:id called');
    console.log('📦 ID:', id);
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    
    const { category, featured, displayOrder, dateTaken, title, caption, alt, location, photographer } = req.body;
    
    const data = {};
    if (category !== undefined) data.category = category;
    if (featured !== undefined) data.featured = featured;
    if (displayOrder !== undefined) data.displayOrder = displayOrder;
    if (dateTaken !== undefined) data.dateTaken = new Date(dateTaken);
    if (title !== undefined) data.title = title;
    if (caption !== undefined) data.caption = caption;
    if (alt !== undefined) data.alt = alt;
    if (location !== undefined) data.location = location;
    if (photographer !== undefined) data.photographer = photographer;
    
    console.log('📝 Update data:', data);
    
    const updatedMedia = await prisma.galleryMedia.update({
      where: { id },
      data,
    });
    
    console.log('✅ Media updated successfully:', updatedMedia.id);
    
    res.json({
      success: true,
      data: {
        mediaItem: updatedMedia,
      },
    });
  } catch (error) {
    console.error('❌ Error updating media:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Media item not found',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update media item',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/gallery/:id
 * Soft delete a single media item
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.galleryMedia.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
    
    res.json({
      success: true,
      message: 'Media item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting media:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Media item not found',
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete media item',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/gallery/bulk-delete
 * Delete multiple media items
 * 
 * Request body:
 * {
 *   itemIds: string[]
 * }
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: itemIds array is required',
      });
    }
    
    const result = await prisma.galleryMedia.updateMany({
      where: {
        id: { in: itemIds },
      },
      data: {
        deletedAt: new Date(),
      },
    });
    
    res.json({
      success: true,
      data: {
        deletedCount: result.count,
      },
    });
  } catch (error) {
    console.error('Error bulk deleting media:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete media items',
      message: error.message,
    });
  }
});

export default router;
