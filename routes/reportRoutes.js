const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticateToken = require('../middleware/auth');

// Report an artist (public authenticated endpoint)
router.post('/report.artist', authenticateToken, reportController.reportArtist);

// Get user's own reports
router.get('/report.myreports', authenticateToken, reportController.getMyReports);

module.exports = router;
