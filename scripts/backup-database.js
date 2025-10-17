/**
 * Database Backup Script
 * 
 * Backs up the Supabase database before migration.
 * Uses Prisma to export data as JSON.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Supabase connection from environment or current DATABASE_URL
const supabaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_DATABASE_URL or DATABASE_URL not found in .env file');
  process.exit(1);
}

// Create Prisma client with Supabase connection
const supabasePrisma = new PrismaClient({
  datasources: {
    db: {
      url: supabaseUrl
    }
  }
});

async function backupDatabase() {
  console.log('🔄 Starting database backup...\n');

  try {
    // Test connection
    await supabasePrisma.$connect();
    console.log('✅ Connected to Supabase database\n');

    // Backup guests
    console.log('📦 Backing up guests...');
    const guests = await supabasePrisma.guest.findMany({
      include: {
        rsvps: true
      }
    });
    console.log(`   Found ${guests.length} guests\n`);

    // Backup RSVPs (note: RSVP model in Prisma)
    console.log('📦 Backing up RSVPs...');
    const rsvps = await supabasePrisma.rSVP.findMany();
    console.log(`   Found ${rsvps.length} RSVPs\n`);

    // Create backup object
    const backup = {
      timestamp: new Date().toISOString(),
      source: 'Supabase',
      database: 'opkvkiaaqjhlfmijyzer',
      data: {
        guests,
        rsvps
      },
      counts: {
        guests: guests.length,
        rsvps: rsvps.length
      }
    };

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `supabase_backup_${timestamp}.json`;
    const filepath = path.join(__dirname, '..', 'backups', filename);

    // Create backups directory if it doesn't exist
    const backupsDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log('✅ Backup completed successfully!');
    console.log(`📁 Backup file: ${filepath}`);
    console.log('\n📊 Backup Summary:');
    console.log(`   - Guests: ${backup.counts.guests}`);
    console.log(`   - RSVPs: ${backup.counts.rsvps}`);
    console.log(`   - Total Records: ${backup.counts.guests + backup.counts.rsvps}`);

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  } finally {
    await supabasePrisma.$disconnect();
  }
}

// Run backup
backupDatabase()
  .then(() => {
    console.log('\n🎉 Backup process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Backup process failed:', error);
    process.exit(1);
  });
