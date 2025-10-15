/**
 * Database Utilities
 * 
 * Utility functions for database connection and health checks.
 * 
 * @module utils/database
 */

import { PrismaClient } from '@prisma/client'

/**
 * Global Prisma client instance
 */
let prisma

/**
 * Get or create Prisma client instance
 * 
 * Handles Supabase connection pooling (PgBouncer) by automatically adding
 * the pgbouncer=true parameter if using transaction mode (port 6543).
 * 
 * @returns {PrismaClient} Prisma client instance
 */
export function getPrismaClient() {
  if (!prisma) {
    // Fix for "prepared statement already exists" error in Supabase
    // Supabase uses PgBouncer in transaction mode, which doesn't support prepared statements
    let dbUrl = process.env.DATABASE_URL

    // Auto-detect transaction mode and add pgbouncer parameter
    if (dbUrl && dbUrl.includes(':6543') && !dbUrl.includes('pgbouncer=true')) {
      const separator = dbUrl.includes('?') ? '&' : '?'
      dbUrl = `${dbUrl}${separator}pgbouncer=true`
      console.log('🔧 [Database] Detected Supabase transaction mode - enabling PgBouncer compatibility')
    }

    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    })

    // Ensure graceful cleanup on process termination
    const cleanup = async () => {
      console.log('🔌 [Database] Disconnecting Prisma client...')
      await prisma.$disconnect()
      prisma = null
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('beforeExit', cleanup)
  }
  return prisma
}

/**
 * Check database connection health
 * 
 * @returns {Promise<Object>} Connection status and metadata
 */
export async function checkDatabaseConnection() {
  const startTime = Date.now()
  
  try {
    const client = getPrismaClient()
    
    // Test connection with a simple query
    await client.$queryRaw`SELECT 1`
    
    const latency = Date.now() - startTime
    
    return {
      status: 'connected',
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL (Supabase)'
    }
  } catch (error) {
    console.error('Database connection error:', error)
    return {
      status: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Gracefully disconnect from database
 * 
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}