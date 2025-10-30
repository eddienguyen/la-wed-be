import express from 'express';

const router = express.Router();

router.get('/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_URL', message: 'URL parameter is required' }
      });
    }

    const imageUrl = decodeURIComponent(url);
    const allowedDomain = 'pub-21ea89e4ac284364a9ca997dff136166.r2.dev';
    
    if (!imageUrl.includes(allowedDomain)) {
      console.warn('Proxy attempt for non-R2 URL blocked:', imageUrl);
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN_URL', message: 'Only R2 bucket images are allowed' }
      });
    }

    console.log('Proxying image:', imageUrl);

    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error('R2 fetch failed:', response.status, response.statusText);
      return res.status(response.status).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: `Failed to fetch image: ${response.statusText}` }
      });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const contentLength = response.headers.get('content-length');

    if (contentLength && Number.parseInt(contentLength, 10) > 10 * 1024 * 1024) {
      console.warn('Image too large:', contentLength);
      return res.status(413).json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'Image file is too large (max 10MB)' }
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('Image proxied successfully:', buffer.length, 'bytes');

    res.set({
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    res.send(buffer);

  } catch (error) {
    console.error('Proxy error:', error);
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
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

router.options('/proxy-image', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  });
  res.status(204).send();
});

export default router;
