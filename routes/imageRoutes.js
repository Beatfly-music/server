const express = require('express');
const path = require('path');
const router = express.Router();

// List of allowed subdirectories (adjust as needed)
const allowedFolders = ['albumArt', 'compressed', 'profilePics'];

/**
 * GET /xrpc/images/:folder/:imageName
 * Serves an image from the specified folder if it is allowed.
 */
router.get('/images/:folder/:imageName', (req, res) => {
  const { folder, imageName } = req.params;
  
  // Check if the requested folder is allowed.
  if (!allowedFolders.includes(folder)) {
    return res.status(400).json({ error: "Invalid folder." });
  }
  
  // Construct the absolute path to the image file.
  const imagePath = path.join(__dirname, '..', 'uploads', folder, imageName);
  const normalizedPath = path.normalize(imagePath);
  
  // Ensure that the normalized path starts with the expected uploads folder path.
  const uploadsPath = path.normalize(path.join(__dirname, '..', 'uploads'));
  if (!normalizedPath.startsWith(uploadsPath)) {
    return res.status(400).json({ error: "Invalid path." });
  }
  
  // Send the file.
  res.sendFile(normalizedPath, (err) => {
    if (err) {
      console.error("Error sending image file:", err);
      return res.status(404).json({ error: "Image not found." });
    }
  });
});

module.exports = router;
