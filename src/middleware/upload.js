/**
 * Upload Middleware - Multer Configuration
 * 
 * Configures Multer for handling multipart/form-data file uploads.
 * Uses memory storage for direct buffer processing with Sharp.
 * 
 * @module middleware/upload
 */

import multer from 'multer'

// Configure memory storage (files stored in memory as Buffer objects)
const storage = multer.memoryStorage()

// File filter to validate upload attempts
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`), false)
  }
}

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_IMAGE_SIZE || '5242880'), // 5MB default
    files: 2 // Max 2 files (front + main)
  }
})

/**
 * Middleware for uploading single file
 */
export const uploadSingle = upload.single('image')

/**
 * Middleware for uploading multiple files (max 2)
 * Field names: 'invitationImageFront' and 'invitationImageMain'
 */
export const uploadMultiple = upload.fields([
  { name: 'invitationImageFront', maxCount: 1 },
  { name: 'invitationImageMain', maxCount: 1 }
])

/**
 * Error handling middleware for Multer errors
 */
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMB = (parseInt(process.env.MAX_IMAGE_SIZE || '5242880') / 1024 / 1024).toFixed(2)
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size: ${maxMB}MB`
      })
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum: 2 files (front + main)'
      })
    }

    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`
    })
  }

  if (err) {
    // Other errors (e.g., from fileFilter)
    return res.status(400).json({
      success: false,
      error: err.message
    })
  }

  next()
}
