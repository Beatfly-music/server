const express = require('express');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs').promises;
const router = express.Router();

// List of allowed subdirectories
const allowedFolders = ['albumArt', 'compressed', 'profilePics'];

// Supported image formats and their mime types
const supportedFormats = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'avif': 'image/avif'
};

/**
 * GET /xrpc/images/:folder/:imageName
 * Serves an optimized image from the specified folder.
 * Supports query parameters:
 * - w: width
 * - h: height
 * - q: quality (1-100)
 * - fmt: format (webp, jpeg, png, avif)
 */
router.get('/images/:folder/:imageName', async (req, res) => {
  try {
    const { folder, imageName } = req.params;
    const { w, h, q = 80, fmt } = req.query;

    // Validate folder
    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({ error: "Invalid folder." });
    }

    // Construct and validate path
    const imagePath = path.join(__dirname, '..', 'uploads', folder, imageName);
    const normalizedPath = path.normalize(imagePath);
    const uploadsPath = path.normalize(path.join(__dirname, '..', 'uploads'));
    
    if (!normalizedPath.startsWith(uploadsPath)) {
      return res.status(400).json({ error: "Invalid path." });
    }

    // Check if file exists
    try {
      await fs.access(normalizedPath);
    } catch {
      return res.status(404).json({ error: "Image not found." });
    }

    // Initialize Sharp transformer
    let transformer = sharp(normalizedPath);

    // Determine output format
    const outputFormat = fmt?.toLowerCase() || path.extname(imageName).slice(1).toLowerCase();
    if (!supportedFormats[outputFormat]) {
      return res.status(400).json({ error: "Unsupported format." });
    }

    // Set content type
    res.set('Content-Type', supportedFormats[outputFormat]);
    
    // Add caching headers
    res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
    res.set('Last-Modified', (new Date()).toUTCString());

    // Apply transformations
    if (w || h) {
      transformer = transformer.resize(
        w ? parseInt(w) : null,
        h ? parseInt(h) : null,
        {
          fit: 'inside',
          withoutEnlargement: true
        }
      );
    }

    // Format-specific optimizations
    switch (outputFormat) {
      case 'jpeg':
      case 'jpg':
        transformer = transformer.jpeg({
          quality: parseInt(q),
          mozjpeg: true, // Use mozjpeg for better compression
          chromaSubsampling: '4:2:0' // Reduce color information for smaller files
        });
        break;
      
      case 'png':
        transformer = transformer.png({
          quality: parseInt(q),
          compressionLevel: 9, // Maximum compression
          palette: true // Use palette-based quantization when possible
        });
        break;
      
      case 'webp':
        transformer = transformer.webp({
          quality: parseInt(q),
          effort: 6, // Higher compression effort
          smartSubsample: true, // Intelligent chroma subsampling
          nearLossless: true // Use near-lossless compression
        });
        break;

      case 'avif':
        transformer = transformer.avif({
          quality: parseInt(q),
          effort: 9, // Maximum compression effort
          chromaSubsampling: '4:2:0'
        });
        break;
    }

    // Stream the processed image
    transformer.pipe(res);

  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({ error: "Error processing image." });
  }
});

module.exports = router;