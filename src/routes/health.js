/**
 * Health Check Routes
 * 
 * API endpoints for monitoring server and database health.
 * 
 * @module routes/health
 */

import express from 'express'
import { checkDatabaseConnection } from '../utils/database.js'

const router = express.Router()

/**
 * GET /api/health
 * 
 * Health check endpoint that verifies server and database status.
 * 
 * @returns {Object} Server health status and database connection info
 */
router.get('/', async (req, res) => {
  try {
    const databaseStatus = await checkDatabaseConnection()
    
    const healthResponse = {
      success: true,
      data: {
        message: 'Server is healthy',
        server: {
          status: 'running',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development'
        },
        database: databaseStatus
      }
    }
    
    // Return 503 if database is not connected
    if (databaseStatus.status !== 'connected') {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database connection failed',
          details: databaseStatus,
          timestamp: new Date().toISOString()
        }
      })
    }
    
    res.status(200).json(healthResponse)
  } catch (error) {
    console.error('Health check error:', error)
    
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      }
    })
  }
})

/**
 * GET /api/health/database
 * 
 * Dedicated database connection health check.
 * 
 * @returns {Object} Database connection status
 */
router.get('/database', async (req, res) => {
  try {
    const databaseStatus = await checkDatabaseConnection()
    
    if (databaseStatus.status === 'connected') {
      res.status(200).json({
        success: true,
        data: databaseStatus
      })
    } else {
      res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_CONNECTION_FAILED',
          message: 'Unable to connect to database',
          details: databaseStatus,
          timestamp: new Date().toISOString()
        }
      })
    }
  } catch (error) {
    console.error('Database health check error:', error)
    
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_HEALTH_CHECK_FAILED',
        message: 'Database health check failed',
        timestamp: new Date().toISOString()
      }
    })
  }
})

export default router