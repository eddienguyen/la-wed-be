/**
 * Gallery Upload Middleware
 * 
 * Enhanced upload middleware specifically for gallery media.
 * Supports larger files and additional media types (images + videos).
 * 
 * @module middleware/galleryUpload
 */

import multer from 'multer'

/**
 * File size limits for gallery uploads
 */
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,  // 10MB for images
  video: 100 * 1024 * 1024  // 100MB for videos
}

/**
 * Allowed MIME types for gallery uploads
 */
const ALLOWED_TYPES = {
  image: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ],
  video: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo'
  ]
}

/**
 * File filter for gallery uploads
 * 
 * Validates file type and size based on media type.
 * 
 * @param {Request} req - Express request object
 * @param {File} file - Multer file object
 * @param {Function} cb - Callback function
 */
const fileFilter = (req, file, cb) => {
  const isImage = ALLOWED_TYPES.image.includes(file.mimetype)
  const isVideo = ALLOWED_TYPES.video.includes(file.mimetype)

  if (!isImage && !isVideo) {
    const allowedExtensions = [
      ...ALLOWED_TYPES.image.map(type => type.split('/')[1]),
      ...ALLOWED_TYPES.video.map(type => type.split('/')[1])
    ].join(', ')

    return cb(
      new Error(
        `Invalid file type. Allowed types: ${allowedExtensions}`
      ),
      false
    )
  }

  // Store media type for later validation
  req.mediaType = isImage ? 'image' : 'video'
  cb(null, true)
}

/**
 * Multer storage configuration
 * 
 * Uses memory storage for processing before R2 upload.
 */
const storage = multer.memoryStorage()

/**
 * Multer upload instance for single file
 * 
 * Configured for gallery media with enhanced limits.
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_SIZE_LIMITS.video, // Use max size, will validate per type
    files: 1
  }
})

/**
 * Middleware to validate file size based on media type
 * 
 * Must be used after multer upload middleware.
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const validateFileSize = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
      message: 'Please provide a file to upload'
    })
  }

  const { size } = req.file
  const maxSize = req.mediaType === 'image' 
    ? FILE_SIZE_LIMITS.image 
    : FILE_SIZE_LIMITS.video

  if (size > maxSize) {
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0)
    return res.status(413).json({
      success: false,
      error: 'File too large',
      message: `${req.mediaType} files must be under ${maxSizeMB}MB`,
      details: {
        uploadedSize: `${(size / 1024 / 1024).toFixed(2)}MB`,
        maxSize: `${maxSizeMB}MB`,
        mediaType: req.mediaType
      }
    })
  }

  next()
}

/**
 * Single file upload for gallery
 * 
 * Handles file upload with field name 'file'.
 */
export const uploadGalleryMedia = upload.single('file')

/**
 * Error handling middleware for multer errors
 * 
 * @param {Error} error - Multer error
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File too large',
        message: 'Upload file size limit exceeded',
        code: 'FILE_TOO_LARGE'
      })
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Invalid file upload',
        message: 'Unexpected file field or too many files',
        code: 'UNEXPECTED_FILE'
      })
    }

    return res.status(400).json({
      success: false,
      error: 'Upload error',
      message: error.message,
      code: error.code
    })
  }

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Upload failed',
      message: error.message
    })
  }

  next()
}
