/**
 * Trigger Migration via API Endpoint
 * Sends exported data to Fly.io API for import
 */

import fs from 'node:fs'
import path from 'node:path'

const API_URL = 'https://ngocquan-wedding-api.fly.dev'

async function triggerImport() {
  try {
    console.log('🚀 Starting migration to Fly.io...\n')
    
    // Find latest export files
    const migrationDir = path.join(process.cwd(), 'migration-data')
    const files = fs.readdirSync(migrationDir)
    
    const guestsFile = files.filter(f => f.startsWith('guests-')).sort().reverse()[0]
    const rsvpsFile = files.filter(f => f.startsWith('rsvps-')).sort().reverse()[0]
    
    if (!guestsFile || !rsvpsFile) {
      throw new Error('Export files not found. Run export-supabase-data.js first.')
    }
    
    console.log(`📂 Loading: ${guestsFile}`)
    console.log(`📂 Loading: ${rsvpsFile}\n`)
    
    // Read data
    const guests = JSON.parse(fs.readFileSync(path.join(migrationDir, guestsFile), 'utf8'))
    const rsvps = JSON.parse(fs.readFileSync(path.join(migrationDir, rsvpsFile), 'utf8'))
    
    console.log(`Sending ${guests.length} guests and ${rsvps.length} RSVPs to Fly.io...`)
    
    // Check current status first
    console.log('\n1️⃣ Checking migration status...')
    const statusRes = await fetch(`${API_URL}/api/migrate/status`)
    const statusData = await statusRes.json()
    
    if (statusData.success) {
      console.log(`   Current counts: ${statusData.data.guests} guests, ${statusData.data.rsvps} RSVPs`)
      
      if (!statusData.data.isEmpty) {
        console.log('\n⚠️  Database already contains data!')
        console.log('   Aborting to prevent duplicates.')
        return
      }
    }
    
    // Send import request
    console.log('\n2️⃣ Importing data...')
    const importRes = await fetch(`${API_URL}/api/migrate/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        guests,
        rsvps
      })
    })
    
    const importData = await importRes.json()
    
    if (!importData.success) {
      console.error('\n❌ Import failed:', importData.error)
      if (importData.details) {
        console.error('   Details:', importData.details)
      }
      process.exit(1)
    }
    
    console.log('\n✅ Import successful!')
    console.log('\n📊 Migration Results:')
    console.log(`   Imported: ${importData.data.imported.guests} guests, ${importData.data.imported.rsvps} RSVPs`)
    console.log(`   Verified: ${importData.data.verified.guests} guests, ${importData.data.verified.rsvps} RSVPs`)
    
    // Final verification
    console.log('\n3️⃣ Final verification...')
    const verifyRes = await fetch(`${API_URL}/api/migrate/status`)
    const verifyData = await verifyRes.json()
    
    if (verifyData.success) {
      console.log(`   Final counts: ${verifyData.data.guests} guests, ${verifyData.data.rsvps} RSVPs`)
      
      if (verifyData.data.guests === guests.length && verifyData.data.rsvps === rsvps.length) {
        console.log('\n🎉 Migration complete and verified!')
      } else {
        console.log('\n⚠️  Count mismatch detected!')
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

// Run import
await triggerImport()
