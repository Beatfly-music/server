const express = require('express');
const router = express.Router();
const albumController = require('../controllers/albumController');
const authenticateToken = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer storage for file uploads.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join('uploads', file.fieldname);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Create an album (requires authentication).
router.post(
  '/music/album.create',
  authenticateToken,
  upload.fields([
    { name: 'albumArt', maxCount: 1 },
    { name: 'tracks', maxCount: 20 }
  ]),
  albumController.createAlbum
);

// Add a track to an existing album (requires authentication).
// Changed from upload.fields to upload.single to match controller's expectation
router.post(
  '/music/album/:albumId/track.add',
  authenticateToken,
  upload.fields([
    { name: 'trackFile', maxCount: 1 },
    { name: 'trackImage', maxCount: 1 }
  ]),
  albumController.addTrackToAlbum
);

// Delete a track from an album (requires authentication).
router.delete(
  '/music/album/:albumId/track/:trackId',
  authenticateToken,
  albumController.deleteTrack
);

// Edit and delete album endpoints (require authentication).
router.put(
  '/music/album.edit/:albumId', 
  authenticateToken, 
  upload.fields([
    { name: 'albumArt', maxCount: 1 }
  ]),
  albumController.editAlbum
);
router.delete('/music/album.delete/:albumId', authenticateToken, albumController.deleteAlbum);

// PUBLIC endpoint: Get album details.
router.get('/music/album/:albumId', albumController.getAlbum);

module.exports = router;