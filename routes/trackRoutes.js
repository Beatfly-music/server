    // routes/trackRoutes.js
const express = require('express');
const router = express.Router();
const trackController = require('../controllers/trackController');
const authenticateToken = require('../middleware/auth');

router.get('/music/track/:trackId', trackController.getTrack);

module.exports = router;
