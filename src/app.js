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
import rsvpRoutes from './routes/rsvp.js'
import migrateRoutes from './routes/migrate.js'
import versionRoutes from './routes/version.js'
import wishesRoutes from './routes/wishes.js'
import galleryRoutes from './routes/gallery.js'
import adminRoutes from './routes/admin/index.js'
import publicRoutes from './routes/public/index.js'
import proxyRoutes from './routes/proxy.js'
import { disconnectDatabase } from './utils/database.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Debug logging - BEFORE all middleware
app.use((req, res, next) => {
  console.group('INCOMING REQUEST:', req.method, req.url, req.headers.origin || 'no-origin')
  console.log('User-Agent:', req.headers['user-agent'])
  console.log('Content-Type:', req.headers['content-type'])
  console.groupEnd();
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
app.use('/api/rsvp', rsvpRoutes)
app.use('/api/migrate', migrateRoutes)
app.use('/api/version', versionRoutes)
app.use('/api/wishes', wishesRoutes)
app.use('/api/gallery', galleryRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/public', publicRoutes)
app.use('/api', proxyRoutes) // Image proxy for CORS workaround

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Wedding Guest Management API',
      version: '1.1.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        databaseHealth: '/api/health/database',
        version: '/api/version',
        guests: {
          list: '/api/guests',
          byId: '/api/guests/:id',
          create: 'POST /api/guests'
        },
        rsvp: {
          list: '/api/rsvp',
          byId: '/api/rsvp/:id',
          create: 'POST /api/rsvp',
          update: 'PATCH /api/rsvp/:id',
          delete: 'DELETE /api/rsvp/:id',
          byVenue: '/api/rsvp/venue/:venue',
          stats: '/api/rsvp/stats/:venue'
        },
        wishes: {
          list: 'GET /api/wishes',
          description: 'Get paginated wishes with optional venue filter'
        },
        gallery: {
          list: 'GET /api/gallery',
          featured: 'GET /api/gallery/featured',
          byId: 'GET /api/gallery/:id',
          upload: 'POST /api/gallery (admin)',
          update: 'PUT /api/gallery/:id (admin)',
          delete: 'DELETE /api/gallery/:id (admin)',
          reorder: 'PUT /api/gallery/reorder (admin)'
        },
        admin: {
          stats: '/api/admin/stats'
        }
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Wedding Guest Management API running on port ${PORT}`)
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
  console.log(`🗄️ Database health: http://localhost:${PORT}/api/health/database`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app