/**
 * Gallery Utility Helpers
 * 
 * Helper functions for gallery operations including pagination,
 * query building, and response formatting.
 * 
 * @module utils/galleryHelpers
 */

/**
 * Build pagination metadata
 * 
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Pagination metadata
 */
export const buildPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit)

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
}

/**
 * Build Prisma where clause for gallery queries
 * 
 * @param {Object} filters - Query filters
 * @param {string} [filters.category] - Filter by category
 * @param {boolean} [filters.featured] - Filter by featured status
 * @param {string} [filters.search] - Search term for title/caption/alt
 * @param {boolean} [filters.includeDeleted=false] - Include soft-deleted items
 * @returns {Object} Prisma where clause
 */
export const buildGalleryWhereClause = (filters = {}) => {
  const where = {}

  // Exclude soft-deleted items by default
  if (!filters.includeDeleted) {
    where.deletedAt = null
  }

  // Category filter
  if (filters.category) {
    where.category = filters.category
  }

  // Featured filter
  if (typeof filters.featured === 'boolean') {
    where.featured = filters.featured
  }

  // Search across multiple fields
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { caption: { contains: filters.search, mode: 'insensitive' } },
      { filename: { contains: filters.search, mode: 'insensitive' } },
      { alt: { contains: filters.search, mode: 'insensitive' } }
    ]
  }

  return where
}

/**
 * Build Prisma orderBy clause for gallery queries
 * 
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort direction ('asc' or 'desc')
 * @returns {Object} Prisma orderBy clause
 */
export const buildGalleryOrderBy = (sortBy = 'createdAt', sortOrder = 'desc') => {
  const validSortFields = ['createdAt', 'displayOrder', 'dateTaken', 'updatedAt']
  
  // Default to createdAt if invalid field
  const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt'
  const order = sortOrder === 'asc' ? 'asc' : 'desc'

  return { [field]: order }
}

/**
 * Format gallery item for API response
 * 
 * Ensures consistent response format and handles null values.
 * 
 * @param {Object} item - Gallery media item from database
 * @returns {Object} Formatted gallery item
 */
export const formatGalleryItem = (item) => {
  if (!item) return null

  return {
    id: item.id,
    filename: item.filename,
    title: item.title || null,
    caption: item.caption || null,
    alt: item.alt || item.filename, // Fallback to filename for accessibility
    mediaType: item.mediaType,
    category: item.category || null,
    r2ObjectKey: item.r2ObjectKey,
    r2Urls: item.r2Urls || {},
    featured: item.featured,
    displayOrder: item.displayOrder,
    metadata: item.metadata || {},
    location: item.location || null,
    photographer: item.photographer || null,
    dateTaken: item.dateTaken ? item.dateTaken.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  }
}

/**
 * Format success response with data
 * 
 * @param {any} data - Response data
 * @param {Object} [pagination] - Optional pagination metadata
 * @returns {Object} Formatted success response
 */
export const formatSuccessResponse = (data, pagination = null) => {
  const response = {
    success: true,
    data
  }

  if (pagination) {
    response.pagination = pagination
  }

  return response
}

/**
 * Format error response
 * 
 * @param {string} error - Error message
 * @param {string} [message] - Detailed message
 * @param {string} [code] - Error code
 * @param {Object} [details] - Additional error details
 * @returns {Object} Formatted error response
 */
export const formatErrorResponse = (error, message = null, code = null, details = null) => {
  const response = {
    success: false,
    error
  }

  if (message) {
    response.message = message
  }

  if (code) {
    response.code = code
  }

  if (details) {
    response.details = details
  }

  return response
}

/**
 * Sanitize filename for storage
 * 
 * Removes special characters and ensures safe filename.
 * 
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export const sanitizeFilename = (filename) => {
  // Get file extension
  const ext = filename.split('.').pop()
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'))

  // Sanitize name: lowercase, replace spaces and special chars
  const sanitized = nameWithoutExt
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(?:^-+|-+$)/g, '') // Remove leading/trailing dashes

  // Add timestamp to ensure uniqueness
  const timestamp = Date.now()

  return `${sanitized}-${timestamp}.${ext}`
}

/**
 * Calculate skip value for pagination
 * 
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {number} Number of items to skip
 */
export const calculateSkip = (page, limit) => {
  return (page - 1) * limit
}

/**
 * Validate and normalize pagination params
 * 
 * @param {number} [page=1] - Requested page number
 * @param {number} [limit=20] - Requested items per page
 * @returns {Object} Normalized pagination params
 */
export const normalizePaginationParams = (page = 1, limit = 20) => {
  // Ensure positive integers
  const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1)
  
  // Enforce max limit of 50
  const normalizedLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20))

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: calculateSkip(normalizedPage, normalizedLimit)
  }
}

/**
 * Extract file metadata from uploaded file
 * 
 * @param {Object} file - Multer file object
 * @returns {Object} File metadata
 */
export const extractFileMetadata = (file) => {
  return {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    uploadedAt: new Date().toISOString()
  }
}
