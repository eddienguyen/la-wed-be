/**
 * RSVP Validation Utilities
 * 
 * Validation rules and sanitization helpers for RSVP data.
 * 
 * @module utils/rsvpValidation
 */

import { body, validationResult } from 'express-validator'

/**
 * Sanitize wishes field to prevent XSS attacks
 * 
 * Removes HTML tags, script content, and potentially dangerous characters.
 * 
 * @param {string} wishes - Raw wishes text
 * @returns {string} Sanitized wishes text
 */
export const sanitizeWishes = (wishes) => {
  if (!wishes || typeof wishes !== 'string') {
    return ''
  }

  return wishes
    .trim()
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Validation rules for RSVP creation
 */
export const validateCreateRSVP = [
  // GuestId - optional UUID
  body('guestId')
    .optional()
    .isUUID()
    .withMessage('Guest ID must be a valid UUID'),

  // Name - required if no guestId, 2-100 characters
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên phải từ 2-100 ký tự')
    .matches(/^[a-zA-ZÀ-ỹ\s'-]+$/)
    .withMessage('Tên chỉ được chứa chữ cái, dấu cách, dấu gạch ngang và dấu nháy đơn'),

  // GuestCount - integer between 1-10
  body('guestCount')
    .isInt({ min: 1, max: 10 })
    .withMessage('Số lượng khách phải từ 1-10'),

  // WillAttend - boolean required
  body('willAttend')
    .isBoolean()
    .withMessage('Xác nhận tham dự là bắt buộc'),

  // Wishes - optional, 10-500 characters if provided
  body('wishes')
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage('Lời chúc phải từ 10-500 ký tự nếu được cung cấp')
    .customSanitizer(sanitizeWishes),

  // Venue - must be hue or hanoi
  body('venue')
    .isIn(['hue', 'hanoi'])
    .withMessage('Địa điểm phải là "hue" hoặc "hanoi"'),

  // Honeypot - must be empty (spam prevention)
  body('honeypot')
    .optional()
    .custom((value) => {
      if (value && value.trim() !== '') {
        throw new Error('Bot detected')
      }
      return true
    })
]

/**
 * Middleware to check validation results
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
export const checkValidationResult = (req, res, next) => {
  const errors = validationResult(req)
  
  if (!errors.isEmpty()) {
    const formattedErrors = {}
    errors.array().forEach(error => {
      formattedErrors[error.path] = error.msg
    })

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: formattedErrors
    })
  }

  next()
}

/**
 * Rate limiting configuration for RSVP endpoint
 * 
 * Prevents abuse by limiting submissions per IP address.
 */
export const rsvpRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many RSVP submissions from this IP, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for successful requests to allow corrections
  skipSuccessfulRequests: false,
  // Skip rate limiting for failed requests to prevent lockout
  skipFailedRequests: false
}
