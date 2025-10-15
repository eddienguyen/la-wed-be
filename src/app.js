/**
 * Express Application Setup
 * 
 * Main application file for the Wedding Guest Management API.
 * 
 * @module app
 */

import express from 'express'
import dotenv from 'dotenv'
import corsMiddleware from './middleware/cors.js'
import healthRoutes from './routes/health.js'
import guestRoutes from './routes/guests.js'
import { disconnectDatabase } from './utils/database.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Debug logging - BEFORE all middleware
app.use((req, res, next) => {
  console.log('🔍 INCOMING REQUEST:', req.method, req.url, req.headers.origin || 'no-origin')
  console.log('🔍 User-Agent:', req.headers['user-agent'])
  console.log('🔍 Content-Type:', req.headers['content-type'])
  next()
})

// Middleware
app.use(corsMiddleware)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
    next()
  })
}

// Response logging middleware for debugging
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (data) {
    console.log('✅ RESPONSE:', res.statusCode, 'for', req.method, req.url);
    return originalSend.call(this, data);
  };
  next();
});

// Routes
app.use('/api/health', healthRoutes)
app.use('/api/guests', guestRoutes)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Wedding Guest Management API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        databaseHealth: '/api/health/database',
        guests: '/api/guests',
        guestById: '/api/guests/:id'
      }
    }
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    }
  })
})

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error)
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }
  })
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server')
  await disconnectDatabase()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server')
  await disconnectDatabase()
  process.exit(0)
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Wedding Guest Management API running on port ${PORT}`)
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
  console.log(`🗄️ Database health: http://localhost:${PORT}/api/health/database`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app