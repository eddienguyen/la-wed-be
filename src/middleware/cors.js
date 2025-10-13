/**
 * CORS Middleware Configuration
 * 
 * Configures Cross-Origin Resource Sharing for the API.
 * 
 * @module middleware/cors
 */

import cors from 'cors'

/**
 * CORS configuration options
 */
const corsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}

/**
 * CORS middleware instance
 */
export default cors(corsOptions)