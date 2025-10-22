/**
 * RSVP Service
 * 
 * Business logic for RSVP management including creation,
 * validation, and duplicate handling.
 * 
 * @module services/rsvpService
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Create a new RSVP submission
 * 
 * Handles both personalized (with guestId) and non-personalized RSVPs.
 * Implements duplicate prevention by updating existing RSVP if found.
 * 
 * @param {Object} data - RSVP data
 * @param {string} [data.guestId] - Optional guest ID for personalized RSVPs
 * @param {string} data.name - Guest name
 * @param {number} data.guestCount - Number of guests attending
 * @param {boolean} data.willAttend - Attendance confirmation
 * @param {string} [data.wishes] - Optional wishes message
 * @param {string} data.venue - Venue (hue or hanoi)
 * @returns {Promise<Object>} Created or updated RSVP record
 * @throws {Error} If guest doesn't exist or validation fails
 */
export const createRSVP = async (data) => {
  const { guestId, name, guestCount, willAttend, wishes, venue } = data

  // Validate guest exists if guestId provided
  if (guestId) {
    const guestExists = await validateGuestExists(guestId)
    if (!guestExists) {
      throw new Error('Guest not found')
    }
  }

  // Check for existing RSVP (duplicate prevention)
  // Strategy: If guestId provided, find by guestId; otherwise find by name+venue
  let existingRSVP = null
  
  if (guestId) {
    existingRSVP = await prisma.rSVP.findFirst({
      where: { guestId }
    })
  } else {
    // For non-personalized RSVPs, check by name and venue
    existingRSVP = await prisma.rSVP.findFirst({
      where: {
        name: name.trim(),
        venue,
        guestId: null
      }
    })
  }

  // If existing RSVP found, update it (latest overwrites)
  if (existingRSVP) {
    const updatedRSVP = await prisma.rSVP.update({
      where: { id: existingRSVP.id },
      data: {
        guestCount,
        willAttend,
        wishes: wishes?.trim() || null,
        updatedAt: new Date()
      },
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            venue: true
          }
        }
      }
    })

    return updatedRSVP
  }

  // Create new RSVP
  const rsvp = await prisma.rSVP.create({
    data: {
      guestId: guestId || null,
      name: name.trim(),
      guestCount,
      willAttend,
      wishes: wishes?.trim() || null,
      venue
    },
    include: {
      guest: {
        select: {
          id: true,
          name: true,
          venue: true
        }
      }
    }
  })

  return rsvp
}

/**
 * Validate that a guest exists in the database
 * 
 * @param {string} guestId - Guest UUID
 * @returns {Promise<boolean>} True if guest exists
 */
export const validateGuestExists = async (guestId) => {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true }
  })

  return !!guest
}

/**
 * Get all RSVPs by venue
 * 
 * @param {string} venue - Venue filter (hue or hanoi)
 * @returns {Promise<Array>} List of RSVPs
 */
export const getRSVPsByVenue = async (venue) => {
  const rsvps = await prisma.rSVP.findMany({
    where: { venue },
    include: {
      guest: {
        select: {
          id: true,
          name: true,
          venue: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return rsvps
}

/**
 * Get RSVP statistics by venue
 * 
 * @param {string} venue - Venue filter (hue or hanoi)
 * @returns {Promise<Object>} Statistics object
 */
export const getRSVPStats = async (venue) => {
  const [totalRSVPs, attendingRSVPs, totalGuestCount] = await Promise.all([
    prisma.rSVP.count({
      where: { venue }
    }),
    prisma.rSVP.count({
      where: { venue, willAttend: true }
    }),
    prisma.rSVP.aggregate({
      where: { venue, willAttend: true },
      _sum: {
        guestCount: true
      }
    })
  ])

  return {
    totalRSVPs,
    attendingCount: attendingRSVPs,
    notAttendingCount: totalRSVPs - attendingRSVPs,
    totalGuests: totalGuestCount._sum.guestCount || 0
  }
}

/**
 * Get RSVP by ID
 * 
 * @param {string} id - RSVP UUID
 * @returns {Promise<Object|null>} RSVP record or null
 */
export const getRSVPById = async (id) => {
  const rsvp = await prisma.rSVP.findUnique({
    where: { id },
    include: {
      guest: {
        select: {
          id: true,
          name: true,
          venue: true
        }
      }
    }
  })

  return rsvp
}

/**
 * Update an existing RSVP
 * 
 * Validates business rules such as venue changes for personalized RSVPs.
 * 
 * @param {string} id - RSVP UUID
 * @param {Object} data - Update data
 * @param {string} [data.name] - Updated guest name
 * @param {number} [data.guestCount] - Updated guest count
 * @param {boolean} [data.willAttend] - Updated attendance status
 * @param {string} [data.wishes] - Updated wishes message
 * @param {string} [data.venue] - Updated venue
 * @returns {Promise<Object>} Updated RSVP record
 * @throws {Error} If RSVP not found or business validation fails
 */
export const updateRSVP = async (id, data) => {
  const { name, guestCount, willAttend, wishes, venue } = data

  // Validate RSVP exists
  const existingRSVP = await prisma.rSVP.findUnique({
    where: { id },
    include: { guest: true }
  })

  if (!existingRSVP) {
    throw new Error('RSVP not found')
  }

  // Business logic validation for venue changes
  // If RSVP is personalized (has guestId) and venue is being changed,
  // ensure new venue matches guest's venue
  if (venue && venue !== existingRSVP.venue && existingRSVP.guestId) {
    const guest = existingRSVP.guest
    if (guest && guest.venue !== venue) {
      throw new Error('Cannot change RSVP venue to differ from guest venue')
    }
  }

  // Build update data object with only provided fields
  const updateData = {}
  if (name !== undefined) updateData.name = name.trim()
  if (guestCount !== undefined) updateData.guestCount = guestCount
  if (willAttend !== undefined) updateData.willAttend = willAttend
  if (wishes !== undefined) updateData.wishes = wishes?.trim() || null
  if (venue !== undefined) updateData.venue = venue

  // Update RSVP
  const updatedRSVP = await prisma.rSVP.update({
    where: { id },
    data: updateData,
    include: {
      guest: {
        select: {
          id: true,
          name: true,
          venue: true
        }
      }
    }
  })

  return updatedRSVP
}

/**
 * Delete an RSVP
 * 
 * Performs hard delete. Consider implementing soft delete for audit purposes.
 * 
 * @param {string} id - RSVP UUID
 * @returns {Promise<Object>} Deleted RSVP record
 * @throws {Error} If RSVP not found
 */
export const deleteRSVP = async (id) => {
  // Check if RSVP exists
  const existingRSVP = await prisma.rSVP.findUnique({
    where: { id },
    select: { id: true, name: true, venue: true, guestId: true }
  })

  if (!existingRSVP) {
    throw new Error('RSVP not found')
  }

  // Hard delete (consider soft delete for audit trail)
  await prisma.rSVP.delete({
    where: { id }
  })

  return existingRSVP
}

/**
 * Get RSVPs with pagination, filtering, and search
 * 
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.venue] - Filter by venue
 * @param {boolean} [options.willAttend] - Filter by attendance status
 * @param {string} [options.search] - Search by name
 * @param {string} [options.sortBy='createdAt'] - Sort field
 * @param {string} [options.sortOrder='desc'] - Sort order (asc/desc)
 * @returns {Promise<Object>} Paginated RSVPs with metadata
 */
export const getRSVPsWithPagination = async (options = {}) => {
  const {
    page = 1,
    limit = 20,
    venue,
    willAttend,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options

  // Build where clause
  const where = {}
  if (venue) where.venue = venue
  if (willAttend !== undefined) where.willAttend = willAttend
  if (search) {
    where.name = {
      contains: search,
      mode: 'insensitive'
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit
  const take = limit

  // Execute queries in parallel for performance
  const [rsvps, total] = await Promise.all([
    prisma.rSVP.findMany({
      where,
      skip,
      take,
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            venue: true
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      }
    }),
    prisma.rSVP.count({ where })
  ])

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit)

  return {
    rsvps,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    }
  }
}

/**
 * Get admin dashboard statistics
 * 
 * Aggregates comprehensive statistics for admin dashboard including
 * guest counts, RSVP counts, attendance, and response rates.
 * 
 * @returns {Promise<Object>} Admin statistics
 */
export const getAdminStats = async () => {
  // Execute all queries in parallel for performance
  const [
    totalGuests,
    guestsByVenue,
    totalRsvps,
    rsvpsByVenue,
    attendingRsvps,
    recentActivity
  ] = await Promise.all([
    // Total guests count
    prisma.guest.count(),
    
    // Guests grouped by venue
    prisma.guest.groupBy({
      by: ['venue'],
      _count: { id: true }
    }),
    
    // Total RSVPs count
    prisma.rSVP.count(),
    
    // RSVPs grouped by venue
    prisma.rSVP.groupBy({
      by: ['venue'],
      _count: { id: true }
    }),
    
    // Sum of guest counts for attending RSVPs
    prisma.rSVP.aggregate({
      where: { willAttend: true },
      _sum: { guestCount: true }
    }),
    
    // Recent activity (last 7 days)
    prisma.rSVP.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    })
  ])

  // Format venue data into object
  const formatVenueData = (data) => {
    return data.reduce((acc, item) => {
      acc[item.venue] = item._count?.id || item._count
      return acc
    }, {})
  }

  // Calculate response rate
  const responseRate = totalGuests > 0 
    ? Math.round((totalRsvps / totalGuests) * 100 * 10) / 10 
    : 0

  return {
    totalGuests,
    guestsByVenue: formatVenueData(guestsByVenue),
    totalRsvps,
    rsvpsByVenue: formatVenueData(rsvpsByVenue),
    attendingGuests: attendingRsvps._sum.guestCount || 0,
    responseRate,
    recentActivity,
    lastUpdated: new Date().toISOString()
  }
}

/**
 * Get paginated wishes data with optional venue filter
 * 
 * Retrieves RSVPs that have wishes, with support for filtering by venue
 * and pagination. Wishes content is sanitized for XSS protection.
 * 
 * @param {Object} options - Query options
 * @param {number} [options.limit=10] - Number of wishes per page (1-50)
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {string} [options.venue] - Optional venue filter (hue or hanoi)
 * @returns {Promise<Object>} Paginated wishes data with metadata
 * 
 * @example
 * // Get first 10 wishes
 * const data = await getWishesData({ limit: 10, page: 1 })
 * 
 * @example
 * // Get Hue venue wishes
 * const data = await getWishesData({ limit: 10, page: 1, venue: 'hue' })
 */
export const getWishesData = async ({ limit = 10, page = 1, venue = null }) => {
  // Build where clause
  const where = {
    AND: [
      {
        wishes: {
          not: null
        }
      },
      {
        wishes: {
          not: ''
        }
      }
    ]
  }

  // Add venue filter if provided
  if (venue) {
    where.venue = venue
  }

  // Calculate pagination
  const skip = (page - 1) * limit

  // Execute queries in parallel
  const [wishes, totalCount] = await Promise.all([
    prisma.rSVP.findMany({
      where,
      select: {
        id: true,
        name: true,
        wishes: true,
        venue: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    }),
    prisma.rSVP.count({ where })
  ])

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / limit)
  const hasNextPage = page < totalPages
  const hasPreviousPage = page > 1

  return {
    wishes: wishes.map(wish => ({
      id: wish.id,
      name: wish.name,
      wishes: wish.wishes,
      venue: wish.venue,
      createdAt: wish.createdAt
    })),
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNextPage,
      hasPreviousPage
    }
  }
}
