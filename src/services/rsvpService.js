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
