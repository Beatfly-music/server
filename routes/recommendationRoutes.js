const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const authenticateToken = require('../middleware/auth');

// Get recommendations for the authenticated user.
router.get('/music.recommendations', authenticateToken, recommendationController.getRecommendations);

module.exports = router;
