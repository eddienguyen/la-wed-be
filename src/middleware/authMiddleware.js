/**
 * Authentication Middleware
 * 
 * Basic authentication middleware for admin endpoints.
 * Currently implemented as a pass-through stub for future enhancement.
 * 
 * @module middleware/authMiddleware
 */

/**
 * Authentication middleware stub
 * 
 * Currently logs authentication attempts but does not enforce authentication.
 * This allows API endpoints to be tested and developed while authentication
 * implementation is pending.
 * 
 * Future enhancement: Implement JWT token validation or session-based auth
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const authenticateAdmin = (req, res, next) => {
  // Log authentication attempt for debugging
  console.log('[Auth] Admin endpoint accessed:', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString()
  })

  // Stub implementation: Allow all requests through
  // Future enhancement will implement JWT token validation or session-based auth
  // Example implementation:
  // - Extract token from Authorization header
  // - Validate token signature and expiration
  // - Set req.user with decoded user info
  // - Return 401 if invalid/missing
  next()
}

/**
 * Optional authentication middleware
 * 
 * Attempts to authenticate but doesn't block if authentication fails.
 * Useful for endpoints that should work differently for authenticated users.
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (authHeader) {
    console.log('[Auth] Optional auth header present:', {
      path: req.path,
      timestamp: new Date().toISOString()
    })
    // Future: Parse and validate token, set req.user if valid
  }

  // Always proceed regardless of authentication status
  next()
}
