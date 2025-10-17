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
 * @returns {PrismaClient} Prisma client instance
 */
export function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
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
      database: 'PostgreSQL'
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