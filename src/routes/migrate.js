/**
 * Database Migration Route
 * Handles data import from Supabase to Fly.io
 */

import express from 'express'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

/**
 * Import data endpoint
 * POST /api/migrate/import
 * Body: { guests: [], rsvps: [] }
 */
router.post('/import', async (req, res) => {
  try {
    const { guests, rsvps } = req.body

    if (!guests || !rsvps) {
      return res.status(400).json({
        success: false,
        error: 'Missing guests or rsvps in request body'
      })
    }

    console.log(`Importing ${guests.length} guests and ${rsvps.length} RSVPs...`)

    // Check if data already exists
    const existingGuests = await prisma.guest.count()
    const existingRSVPs = await prisma.rSVP.count()

    if (existingGuests > 0 || existingRSVPs > 0) {
      return res.status(409).json({
        success: false,
        error: 'Database already contains data',
        details: {
          existingGuests,
          existingRSVPs
        }
      })
    }

    // Import guests
    const importedGuests = await prisma.guest.createMany({
      data: guests.map(g => ({
        id: g.id,
        name: g.name,
        secondaryNote: g.secondaryNote,
        venue: g.venue,
        invitationUrl: g.invitationUrl,
        invitationImageFrontUrl: g.invitationImageFrontUrl,
        invitationImageMainUrl: g.invitationImageMainUrl,
        createdAt: new Date(g.createdAt),
        updatedAt: new Date(g.updatedAt)
      }))
    })

    // Import RSVPs
    const importedRSVPs = await prisma.rSVP.createMany({
      data: rsvps.map(r => ({
        id: r.id,
        guestId: r.guestId,
        name: r.name,
        guestCount: r.guestCount,
        willAttend: r.willAttend,
        wishes: r.wishes,
        venue: r.venue,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt)
      }))
    })

    // Verify
    const finalGuests = await prisma.guest.count()
    const finalRSVPs = await prisma.rSVP.count()

    res.json({
      success: true,
      data: {
        imported: {
          guests: importedGuests.count,
          rsvps: importedRSVPs.count
        },
        verified: {
          guests: finalGuests,
          rsvps: finalRSVPs
        }
      }
    })

  } catch (error) {
    console.error('Import error:', error)
    res.status(500).json({
      success: false,
      error: 'Import failed',
      details: error.message
    })
  }
})

/**
 * Check migration status
 * GET /api/migrate/status
 */
router.get('/status', async (req, res) => {
  try {
    const guests = await prisma.guest.count()
    const rsvps = await prisma.rSVP.count()

    res.json({
      success: true,
      data: {
        guests,
        rsvps,
        isEmpty: guests === 0 && rsvps === 0
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
