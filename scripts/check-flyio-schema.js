/**
 * Check Fly.io Database Schema
 * Verifies tables and row counts after migration
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSchema() {
  try {
    console.log('🔍 Checking database schema...\n')
    
    // Get all tables
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname='public'
      ORDER BY tablename
    `
    
    console.log('📋 Tables in database:')
    console.log(JSON.stringify(tables, null, 2))
    
    // Check Guest table
    const guestCount = await prisma.guest.count()
    console.log(`\n👥 Guest table: ${guestCount} rows`)
    
    // Check RSVP table
    const rsvpCount = await prisma.rSVP.count()
    console.log(`📝 RSVP table: ${rsvpCount} rows`)
    
    // Get a sample guest if any exist
    if (guestCount > 0) {
      const sampleGuest = await prisma.guest.findFirst()
      console.log('\n📌 Sample Guest:')
      console.log(JSON.stringify(sampleGuest, null, 2))
    }
    
    console.log('\n✅ Schema check complete!')
    
  } catch (error) {
    console.error('❌ Error checking schema:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run check
await checkSchema()
