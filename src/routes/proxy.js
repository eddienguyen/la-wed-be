/**
 * Image Proxy Routes
 * 
 * Provides a proxy endpoint to bypass CORS restrictions for R2 images.
 * This is a workaround for sharing images on mobile devices when R2 CORS
 * configuration cannot be updated or is not working correctly.
 * 
 * @module routes/proxy
 */

import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * Proxy image from R2 bucket
 * 
 * GET /api/proxy-image?url=<encoded-url>
 * 
 * This endpoint:
 * 1. Fetches the image from R2 bucket on the backend
 * 2. Returns it with proper CORS headers
 * 3. Bypasses browser CORS restrictions
 * 
 * Query Parameters:
 * - url: URL-encoded image URL to proxy
 * 
 * Security:
 * - Only allows R2 bucket URLs (pub-21ea89e4ac284364a9ca997dff136166.r2.dev)
 * - Validates URL format
 * - Limits file size
 */
router.get('/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;

    // Validate URL parameter
    if (!url) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'URL parameter is required'
        }
      });
    }

    // Decode URL
    const imageUrl = decodeURIComponent(url);

    // Security: Only allow R2 bucket URLs
    const allowedDomain = 'pub-21ea89e4ac284364a9ca997dff136166.r2.dev';
    if (!imageUrl.includes(allowedDomain)) {
      console.warn('⚠️ Proxy attempt for non-R2 URL blocked:', imageUrl);
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_URL',
          message: 'Only R2 bucket images are allowed'
        }
      });
    }

    console.log('📥 Proxying image:', imageUrl);

    // Fetch image from R2
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Wedding-API-Proxy/1.0'
      }
    });

    if (!response.ok) {
      console.error('❌ R2 fetch failed:', response.status, response.statusText);
      return res.status(response.status).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: `Failed to fetch image: ${response.statusText}`
        }
      });
    }

    // Get content type from R2 response
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const contentLength = response.headers.get('content-length');

    // Security: Limit file size to 10MB
    if (contentLength && Number.parseInt(contentLength) > 10 * 1024 * 1024) {
      console.warn('⚠️ Image too large:', contentLength);
      return res.status(413).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Image file is too large (max 10MB)'
        }
      });
    }

    // Get image buffer
    const buffer = await response.buffer();

    console.log('✅ Image proxied successfully:', buffer.length, 'bytes');

    // Set appropriate headers
    res.set({
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'Access-Control-Allow-Origin': '*', // Allow all origins for proxied images
      'Access-Control-Allow-Methods': 'GET, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // Send image buffer
    res.send(buffer);

  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'Failed to proxy image',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

/**
 * Preflight OPTIONS request handler
 */
router.options('/proxy-image', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400' // 24 hours
  });
  res.status(204).send();
});

export default router;
