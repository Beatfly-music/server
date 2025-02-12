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

// Edit and delete endpoints (require authentication).
router.put('/music/album.edit/:albumId', authenticateToken, albumController.editAlbum);
router.delete('/music/album.delete/:albumId', authenticateToken, albumController.deleteAlbum);

// PUBLIC endpoint: Get album details.
router.get('/music/album/:albumId', albumController.getAlbum);

module.exports = router;
