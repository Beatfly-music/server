const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authenticateToken = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for profile picture uploads.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join('uploads', 'profilePics');
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

// User profile endpoints.
router.get('/profile.get', authenticateToken, profileController.getUserProfile);
router.post('/profile.update', authenticateToken, upload.single('profilePic'), profileController.updateUserProfile);

// Artist profile endpoints.
router.get('/artist.getProfile', profileController.getArtistProfile);
router.post('/artist.updateProfile', authenticateToken, profileController.updateArtistProfile);

module.exports = router;
