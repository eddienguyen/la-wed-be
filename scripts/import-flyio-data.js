/**
 * Import Data to Fly.io PostgreSQL
 * Imports guests and RSVPs from exported JSON files
 */

import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

const prisma = new PrismaClient()

async function importData() {
  try {
    console.log('📥 Importing data to Fly.io PostgreSQL...\n')
    
    // Find latest export files
    const migrationDir = path.join(process.cwd(), 'migration-data')
    const files = fs.readdirSync(migrationDir)
    
    const guestsFile = files.filter(f => f.startsWith('guests-')).sort().reverse()[0]
    const rsvpsFile = files.filter(f => f.startsWith('rsvps-')).sort().reverse()[0]
    
    if (!guestsFile || !rsvpsFile) {
      throw new Error('Export files not found. Run export-supabase-data.js first.')
    }
    
    console.log(`📂 Reading: ${guestsFile}`)
    console.log(`📂 Reading: ${rsvpsFile}\n`)
    
    // Read data
    const guests = JSON.parse(fs.readFileSync(path.join(migrationDir, guestsFile), 'utf8'))
    const rsvps = JSON.parse(fs.readFileSync(path.join(migrationDir, rsvpsFile), 'utf8'))
    
    console.log(`Found ${guests.length} guests and ${rsvps.length} RSVPs to import\n`)
    
    // Check if data already exists
    const existingGuests = await prisma.guest.count()
    const existingRSVPs = await prisma.rSVP.count()
    
    if (existingGuests > 0 || existingRSVPs > 0) {
      console.log(`⚠️  Database already contains data:`)
      console.log(`   Guests: ${existingGuests}`)
      console.log(`   RSVPs: ${existingRSVPs}`)
      console.log(`\n❌ Aborting to prevent duplicates.`)
      console.log(`   If you want to re-import, manually clear the tables first.\n`)
      process.exit(1)
    }
    
    // Import guests
    console.log('👥 Importing guests...')
    let guestCount = 0
    for (const guest of guests) {
      await prisma.guest.create({
        data: {
          id: guest.id,
          name: guest.name,
          secondaryNote: guest.secondaryNote,
          venue: guest.venue,
          invitationUrl: guest.invitationUrl,
          invitationImageFrontUrl: guest.invitationImageFrontUrl,
          invitationImageMainUrl: guest.invitationImageMainUrl,
          createdAt: new Date(guest.createdAt),
          updatedAt: new Date(guest.updatedAt)
        }
      })
      guestCount++
      if (guestCount % 10 === 0) {
        process.stdout.write(`   Imported ${guestCount}/${guests.length}...\r`)
      }
    }
    console.log(`   ✅ Imported ${guestCount} guests                    `)
    
    // Import RSVPs
    console.log('📝 Importing RSVPs...')
    let rsvpCount = 0
    for (const rsvp of rsvps) {
      await prisma.rSVP.create({
        data: {
          id: rsvp.id,
          guestId: rsvp.guestId,
          name: rsvp.name,
          guestCount: rsvp.guestCount,
          willAttend: rsvp.willAttend,
          wishes: rsvp.wishes,
          venue: rsvp.venue,
          createdAt: new Date(rsvp.createdAt),
          updatedAt: new Date(rsvp.updatedAt)
        }
      })
      rsvpCount++
    }
    console.log(`   ✅ Imported ${rsvpCount} RSVPs`)
    
    // Verify counts
    const finalGuests = await prisma.guest.count()
    const finalRSVPs = await prisma.rSVP.count()
    
    console.log('\n📊 Migration Summary:')
    console.log(`   Guests: ${finalGuests} (expected: ${guests.length})`)
    console.log(`   RSVPs: ${finalRSVPs} (expected: ${rsvps.length})`)
    
    if (finalGuests === guests.length && finalRSVPs === rsvps.length) {
      console.log('\n✅ Migration successful!')
    } else {
      console.log('\n⚠️  Count mismatch detected!')
    }
    
  } catch (error) {
    console.error('\n❌ Error importing data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run import
await importData()
