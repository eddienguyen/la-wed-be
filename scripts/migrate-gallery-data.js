/**
 * Data Migration Script: Media → GalleryMedia
 * 
 * Migrates existing media records from the old Media model
 * to the new GalleryMedia model with proper field transformation.
 * 
 * Usage: node scripts/migrate-gallery-data.js [--dry-run] [--backup]
 * 
 * @module scripts/migrate-gallery-data
 */

import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

// Command line arguments
const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const shouldBackup = args.has('--backup');

/**
 * Extract R2 object key from URL
 * 
 * @param {string} url - Full URL to media file
 * @returns {string} R2 object key
 */
function extractR2Key(url) {
  // Example: https://pub-xxx.r2.dev/gallery/2025-01/image-123.jpg
  // Extract: gallery/2025-01/image-123.jpg
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  } catch {
    // Fallback if not a valid URL
    return url.split('/').slice(-3).join('/');
  }
}

/**
 * Generate alt text from filename
 * 
 * @param {string} filename - Original filename
 * @returns {string} Human-readable alt text
 */
function generateAltText(filename) {
  // Remove extension and replace hyphens/underscores with spaces
  return filename
    .replace(/\.[^/.]+$/, '')
    .replaceAll(/[-_]/g, ' ')
    .replaceAll(/\b\w/g, l => l.toUpperCase());
}

/**
 * Transform Media record to GalleryMedia format
 * 
 * @param {Object} mediaRecord - Original Media record
 * @returns {Object} Transformed GalleryMedia record
 */
function transformMediaRecord(mediaRecord) {
  // Build r2Urls JSON structure
  const r2Urls = {
    thumbnail: mediaRecord.thumbnailUrl || mediaRecord.url,
    medium: mediaRecord.url,
    large: mediaRecord.url,
    original: mediaRecord.url,
  };

  // Build metadata JSON structure
  const metadata = {
    fileSize: mediaRecord.fileSize,
    width: mediaRecord.width,
    height: mediaRecord.height,
    format: path.extname(mediaRecord.filename).substring(1),
  };

  // Extract R2 key from URL
  const r2ObjectKey = extractR2Key(mediaRecord.url);

  // Generate alt text if not provided
  const alt = generateAltText(mediaRecord.filename);

  return {
    // Keep original ID
    id: mediaRecord.id,
    filename: mediaRecord.filename,
    
    // New display fields (default to null for admin to fill)
    title: null,
    caption: null,
    alt: alt,
    
    // Renamed/transformed fields
    mediaType: mediaRecord.type, // 'type' -> 'mediaType'
    category: mediaRecord.category === 'uncategorized' ? 'general' : mediaRecord.category,
    
    // R2 integration
    r2ObjectKey: r2ObjectKey,
    r2Urls: r2Urls,
    
    // Display config
    featured: mediaRecord.isFeatured, // 'isFeatured' -> 'featured'
    displayOrder: mediaRecord.displayOrder,
    
    // Metadata
    metadata: metadata,
    
    // Additional context
    location: null,
    photographer: mediaRecord.uploadedBy, // Repurpose 'uploadedBy' -> 'photographer'
    dateTaken: mediaRecord.dateTaken,
    
    // Soft delete (all existing records are active)
    deletedAt: null,
    
    // Timestamps
    createdAt: mediaRecord.createdAt,
    updatedAt: mediaRecord.updatedAt,
  };
}

/**
 * Backup existing media records
 */
async function backupMediaRecords() {
  console.log('📦 Creating backup of existing media records...');
  
  const mediaRecords = await prisma.media.findMany();
  const backupPath = path.join(
    process.cwd(),
    'backups',
    `media-backup-${new Date().toISOString().split('T')[0]}.json`
  );
  
  // Ensure backups directory exists
  const backupsDir = path.dirname(backupPath);
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  
  fs.writeFileSync(backupPath, JSON.stringify(mediaRecords, null, 2));
  console.log(`✅ Backup saved to: ${backupPath}`);
  console.log(`   Records backed up: ${mediaRecords.length}`);
  
  return mediaRecords.length;
}

/**
 * Migrate media records
 */
async function migrateRecords() {
  console.log('\n🔄 Starting media record migration...');
  
  // Fetch all existing media records
  const mediaRecords = await prisma.media.findMany({
    orderBy: { createdAt: 'asc' },
  });
  
  console.log(`   Found ${mediaRecords.length} media records to migrate`);
  
  if (mediaRecords.length === 0) {
    console.log('⚠️  No records to migrate');
    return { success: 0, failed: 0 };
  }
  
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };
  
  for (const record of mediaRecords) {
    try {
      const transformedRecord = transformMediaRecord(record);
      
      if (isDryRun) {
        console.log(`   [DRY RUN] Would migrate: ${record.filename}`);
        console.log(`      ID: ${record.id}`);
        console.log(`      Category: ${record.category} -> ${transformedRecord.category}`);
        console.log(`      Featured: ${record.isFeatured} -> ${transformedRecord.featured}`);
        results.success++;
      } else {
        await prisma.galleryMedia.create({
          data: transformedRecord,
        });
        console.log(`   ✅ Migrated: ${record.filename} (${record.id})`);
        results.success++;
      }
    } catch (error) {
      console.error(`   ❌ Failed to migrate ${record.filename}:`, error.message);
      results.failed++;
      results.errors.push({
        record: record.filename,
        error: error.message,
      });
    }
  }
  
  return results;
}

/**
 * Validate migrated data
 */
async function validateMigration() {
  console.log('\n🔍 Validating migration...');
  
  const mediaCount = await prisma.media.count();
  const galleryMediaCount = await prisma.galleryMedia.count();
  
  console.log(`   Original Media records: ${mediaCount}`);
  console.log(`   Migrated GalleryMedia records: ${galleryMediaCount}`);
  
  if (mediaCount === galleryMediaCount) {
    console.log('   ✅ Record counts match!');
  } else {
    console.log('   ⚠️  Record counts do NOT match!');
  }
  
  // Sample validation - check a few records
  const sampleMedia = await prisma.media.findMany({ take: 3 });
  
  for (const media of sampleMedia) {
    const galleryMedia = await prisma.galleryMedia.findUnique({
      where: { id: media.id },
    });
    
    if (galleryMedia) {
      console.log(`   ✅ Record ${media.filename} migrated correctly`);
    } else {
      console.log(`   ❌ Record ${media.filename} NOT found in GalleryMedia`);
    }
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('==========================================');
  console.log('📸 Gallery Data Migration: Media → GalleryMedia');
  console.log('==========================================\n');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  try {
    // Phase 1: Backup
    if (shouldBackup && !isDryRun) {
      await backupMediaRecords();
    }
    
    // Phase 2: Migrate
    const results = await migrateRecords();
    
    // Phase 3: Validate
    if (!isDryRun && results.success > 0) {
      await validateMigration();
    }
    
    // Summary
    console.log('\n==========================================');
    console.log('📊 Migration Summary');
    console.log('==========================================');
    console.log(`✅ Successfully migrated: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);
    
    if (results.errors && results.errors.length > 0) {
      console.log('\n❌ Errors:');
      let index = 0;
      for (const err of results.errors) {
        index++;
        console.log(`   ${index}. ${err.record}: ${err.error}`);
      }
    }
    
    console.log('\n==========================================');
    
    if (isDryRun) {
      console.log('\n💡 To execute the migration, run:');
      console.log('   node scripts/migrate-gallery-data.js --backup');
    } else if (results.success > 0) {
      console.log('\n✅ Migration complete!');
      console.log('\n⚠️  Next steps:');
      console.log('   1. Verify migrated data in database');
      console.log('   2. Update application code to use GalleryMedia model');
      console.log('   3. Test thoroughly before dropping old Media table');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute migration
await main();
