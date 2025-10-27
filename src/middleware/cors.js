/**
 * CORS Middleware Configuration
 * 
 * Configures Cross-Origin Resource Sharing for the API.
 * 
 * @module middleware/cors
 */

import cors from 'cors'

/**
 * Determine allowed origins based on environment
 */
const getAllowedOrigins = () => {
  const envOrigin = process.env.CORS_ORIGIN;
  
  if (process.env.NODE_ENV === 'production') {
    // In production, use environment variable or default to production domain
    return envOrigin ? envOrigin.split(',').map(origin => origin.trim()) : ['https://ngocquanwd.com'];
  }
  
  // In development, allow common dev origins + network IP for mobile testing
  return [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:3000',
    'http://192.168.0.101:5173', // Network IP for mobile testing
    ...(envOrigin ? envOrigin.split(',').map(origin => origin.trim()) : [])
  ];
};

const allowedOrigins = getAllowedOrigins();

/**
 * CORS configuration options
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked request from origin: ${origin}`);
      console.warn(`   Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}

/**
 * CORS middleware instance
 */
export default cors(corsOptions)