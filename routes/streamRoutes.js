// router.js
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth')
const streamController = require('../controllers/streamController');

// The authMiddleware ensures req.user is set before calling streamAudio.
router.get('/music/stream/:trackId', authenticate, streamController.streamAudio);

module.exports = router;
