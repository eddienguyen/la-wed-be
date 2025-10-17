/**
 * Export Supabase Data for Migration
 * Extracts all guests and RSVPs from Supabase database
 */

import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

// Use Supabase connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.SUPABASE_URL
    }
  }
})

async function exportData() {
  try {
    console.log('📊 Exporting data from Supabase...\n')
    
    // Export Guests
    const guests = await prisma.guest.findMany({
      orderBy: { createdAt: 'asc' }
    })
    console.log(`✅ Found ${guests.length} guests`)
    
    // Export RSVPs
    const rsvps = await prisma.rSVP.findMany({
      orderBy: { createdAt: 'asc' }
    })
    console.log(`✅ Found ${rsvps.length} RSVPs`)
    
    // Create export directory
    const exportDir = path.join(process.cwd(), 'migration-data')
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }
    
    // Save to JSON files
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
    
    const guestsFile = path.join(exportDir, `guests-${timestamp}.json`)
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2))
    console.log(`💾 Saved guests to: ${guestsFile}`)
    
    const rsvpsFile = path.join(exportDir, `rsvps-${timestamp}.json`)
    fs.writeFileSync(rsvpsFile, JSON.stringify(rsvps, null, 2))
    console.log(`💾 Saved RSVPs to: ${rsvpsFile}`)
    
    // Create summary
    const summary = {
      exportDate: new Date().toISOString(),
      source: 'Supabase',
      counts: {
        guests: guests.length,
        rsvps: rsvps.length
      },
      files: {
        guests: path.basename(guestsFile),
        rsvps: path.basename(rsvpsFile)
      }
    }
    
    const summaryFile = path.join(exportDir, `export-summary-${timestamp}.json`)
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2))
    console.log(`📋 Saved summary to: ${summaryFile}`)
    
    // Display sample data
    if (guests.length > 0) {
      console.log('\n👤 Sample Guest:')
      console.log(JSON.stringify(guests[0], null, 2))
    }
    
    if (rsvps.length > 0) {
      console.log('\n📝 Sample RSVP:')
      console.log(JSON.stringify(rsvps[0], null, 2))
    }
    
    console.log('\n✅ Export complete!')
    console.log(`📁 Data saved to: ${exportDir}`)
    
  } catch (error) {
    console.error('❌ Error exporting data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run export
await exportData()
