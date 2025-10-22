/**
 * Database Connection Manager
 * 
 * Handles robust database connections with retry logic, validation,
 * and cold start protection for Supabase pooler connections.
 * 
 * @module utils/db-connection-manager
 */

import { PrismaClient } from '@prisma/client'

const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 10000 // 10 seconds
const CONNECTION_TIMEOUT = 10000 // 10 seconds

/**
 * Validates that DATABASE_URL is properly configured for Supabase pooler
 * 
 * @throws {Error} If DATABASE_URL is not properly configured
 */
function validateDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL
  
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // Check if using direct connection (port 5432) - this is problematic
  if (dbUrl.includes(':5432/') && !dbUrl.includes('pgbouncer=true')) {
    console.warn('⚠️  WARNING: DATABASE_URL uses port 5432 without pgbouncer parameter')
    console.warn('   This may cause "Can\'t reach database server" errors')
    console.warn('   Recommended: Use port 6543 with pgbouncer=true for application queries')
    console.warn('   Example: postgresql://user:pass@host.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1')
  }

  // Check if using pooler on port 6543
  if (dbUrl.includes(':6543/')) {
    if (!dbUrl.includes('pgbouncer=true')) {
      console.warn('⚠️  WARNING: Using port 6543 but missing pgbouncer=true parameter')
      console.warn('   Adding pgbouncer=true to prevent prepared statement errors')
    }
    if (!dbUrl.includes('connection_limit=')) {
      console.warn('⚠️  INFO: Consider adding connection_limit=1 to prevent connection exhaustion')
    }
  }

  // Validate it's a Supabase pooler URL
  if (dbUrl.includes('supabase.com')) {
    if (!dbUrl.includes('.pooler.supabase.com')) {
      console.warn('⚠️  WARNING: Supabase URL should use .pooler.supabase.com for stability')
    }
  }

  return true
}

/**
 * Sleep utility for retry delays
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Exponential backoff calculation
 * 
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function getRetryDelay(attempt) {
  const delay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, attempt),
    MAX_RETRY_DELAY
  )
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000
}

/**
 * Test database connection with timeout
 * 
 * @param {PrismaClient} client - Prisma client instance
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection(client) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT)
  })

  const connectionPromise = client.$queryRaw`SELECT 1 as connected`

  try {
    await Promise.race([connectionPromise, timeoutPromise])
    return true
  } catch (error) {
    throw error
  }
}

/**
 * Connect to database with retry logic
 * 
 * Implements exponential backoff with jitter for cold start resilience
 * 
 * @param {PrismaClient} client - Prisma client instance
 * @returns {Promise<void>}
 * @throws {Error} If connection fails after all retries
 */
async function connectWithRetry(client) {
  let lastError

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`🔌 Attempting database connection (attempt ${attempt + 1}/${MAX_RETRIES})...`)
      
      await client.$connect()
      await testConnection(client)
      
      console.log('✅ Database connected successfully')
      return
    } catch (error) {
      lastError = error
      
      const isP1001 = error.code === 'P1001'
      const isTimeout = error.message?.includes('timeout')
      const isNetworkError = error.message?.includes('ECONNREFUSED') || 
                            error.message?.includes('ETIMEDOUT') ||
                            error.message?.includes('ENOTFOUND')

      if (isP1001) {
        console.error(`❌ P1001 Error: Can't reach database server`)
        console.error('   This usually means:')
        console.error('   1. Using wrong port (5432 instead of 6543 for pooler)')
        console.error('   2. Database pooler is cold-starting')
        console.error('   3. Network connectivity issues')
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = getRetryDelay(attempt)
        console.log(`⏳ Retrying in ${Math.round(delay)}ms...`)
        await sleep(delay)
      } else {
        console.error(`❌ Failed to connect after ${MAX_RETRIES} attempts`)
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Database connection failed after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`
  )
}

/**
 * Initialize database connection with validation and retry logic
 * 
 * @returns {Promise<PrismaClient>} Connected Prisma client
 */
export async function initializeDatabase() {
  console.log('🗄️  Initializing database connection...')
  
  // Validate configuration first
  try {
    validateDatabaseUrl()
  } catch (error) {
    console.error('❌ Database configuration error:', error.message)
    throw error
  }

  // Fix for Supabase PgBouncer prepared statement issues
  let dbUrl = process.env.DATABASE_URL
  
  // Auto-add pgbouncer parameter if using port 6543
  if (dbUrl.includes(':6543/') && !dbUrl.includes('pgbouncer=true')) {
    const separator = dbUrl.includes('?') ? '&' : '?'
    dbUrl = `${dbUrl}${separator}pgbouncer=true`
    console.log('ℹ️  Auto-added pgbouncer=true parameter')
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    },
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  })

  // Connect with retry logic
  await connectWithRetry(prisma)

  // Setup graceful shutdown
  setupGracefulShutdown(prisma)

  return prisma
}

/**
 * Setup graceful shutdown handlers
 * 
 * @param {PrismaClient} client - Prisma client instance
 */
function setupGracefulShutdown(client) {
  const shutdown = async (signal) => {
    console.log(`\n📴 ${signal} received. Closing database connection...`)
    try {
      await client.$disconnect()
      console.log('✅ Database connection closed')
      process.exit(0)
    } catch (error) {
      console.error('❌ Error during shutdown:', error)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('beforeExit', async () => {
    await client.$disconnect()
  })
}

/**
 * Health check with connection validation
 * 
 * @param {PrismaClient} client - Prisma client instance
 * @returns {Promise<Object>} Health check result
 */
export async function performHealthCheck(client) {
  const startTime = Date.now()
  
  try {
    await client.$queryRaw`SELECT 1 as health_check`
    const latency = Date.now() - startTime

    return {
      status: 'connected',
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL (Supabase)'
    }
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    }
  }
}

export default {
  initializeDatabase,
  performHealthCheck
}
