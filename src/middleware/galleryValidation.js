/**
 * Gallery Validation Middleware
 * 
 * Validation rules for gallery API endpoints using express-validator.
 * Provides comprehensive input validation for queries, uploads, and updates.
 * 
 * @module middleware/galleryValidation
 */

import { body, query, param, validationResult } from 'express-validator'

/**
 * Validation rules for GET /api/gallery query parameters
 */
export const validateGalleryQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),

  query('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category too long')
    .escape(), // Prevent XSS

  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be true or false')
    .toBoolean(),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query too long')
    .escape(), // Prevent XSS

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'displayOrder', 'dateTaken', 'updatedAt'])
    .withMessage('Invalid sort field. Allowed: createdAt, displayOrder, dateTaken, updatedAt'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
    .toLowerCase(),
]

/**
 * Validation rules for POST /api/gallery (upload)
 */
export const validateGalleryUpload = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title too long (max 200 characters)')
    .escape(),

  body('caption')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Caption too long (max 1000 characters)')
    .escape(),

  body('alt')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Alt text too long (max 200 characters)')
    .escape(),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category too long (max 50 characters)')
    .isIn(['wedding', 'engagement', 'pre-wedding', 'ceremony', 'reception', 'other'])
    .withMessage('Invalid category'),

  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be true or false')
    .toBoolean(),

  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer')
    .toInt(),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location too long (max 200 characters)')
    .escape(),

  body('photographer')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Photographer name too long (max 100 characters)')
    .escape(),

  body('dateTaken')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format (use ISO 8601)')
    .toDate(),
]

/**
 * Validation rules for PUT /api/gallery/:id (update)
 */
export const validateGalleryUpdate = [
  param('id')
    .isUUID()
    .withMessage('Invalid media ID format'),

  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title too long (max 200 characters)')
    .escape(),

  body('caption')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Caption too long (max 1000 characters)')
    .escape(),

  body('alt')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Alt text too long (max 200 characters)')
    .escape(),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category too long (max 50 characters)')
    .isIn(['wedding', 'engagement', 'pre-wedding', 'ceremony', 'reception', 'other'])
    .withMessage('Invalid category'),

  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be true or false')
    .toBoolean(),

  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer')
    .toInt(),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location too long (max 200 characters)')
    .escape(),

  body('photographer')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Photographer name too long (max 100 characters)')
    .escape(),

  body('dateTaken')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format (use ISO 8601)')
    .toDate(),
]

/**
 * Validation rules for DELETE /api/gallery/:id
 */
export const validateGalleryDelete = [
  param('id')
    .isUUID()
    .withMessage('Invalid media ID format'),

  query('permanent')
    .optional()
    .isBoolean()
    .withMessage('Permanent must be true or false')
    .toBoolean(),
]

/**
 * Validation rules for PUT /api/gallery/reorder (bulk update)
 */
export const validateGalleryReorder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items must be a non-empty array'),

  body('items.*.id')
    .isUUID()
    .withMessage('Each item must have a valid UUID'),

  body('items.*.displayOrder')
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer')
    .toInt(),
]

/**
 * Validation rules for GET /api/gallery/:id
 */
export const validateGalleryById = [
  param('id')
    .isUUID()
    .withMessage('Invalid media ID format'),
]

/**
 * Middleware to check validation results
 * 
 * Returns standardized error response if validation fails.
 * Must be used after validation rules.
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }))

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Invalid request parameters',
      details: formattedErrors
    })
  }

  next()
}
