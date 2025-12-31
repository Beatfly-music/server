const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');

// ==================== USER OVERVIEW ====================
router.get(
  '/admin/user/:userId/yearinreview',
  authenticateToken,
  requireAdmin,
  userController.getYearInReviewForAdmin
);

router.get(
  '/admin/user/:userId/overview',
  authenticateToken,
  requireAdmin,
  userController.getAdminUserOverview
);

// ==================== STATS ====================
router.get('/admin/stats', authenticateToken, requireAdmin, adminController.getStats);
router.get('/admin/users', authenticateToken, requireAdmin, adminController.getAllUsers);
router.get('/admin/artists', authenticateToken, requireAdmin, adminController.getAllArtists);

// ==================== USER MANAGEMENT ====================
router.post('/admin/user/ban', authenticateToken, requireAdmin, adminController.banUser);
router.delete('/admin/user/ban/:userId', authenticateToken, requireAdmin, adminController.unbanUser);
router.get('/admin/user/banned', authenticateToken, requireAdmin, adminController.getBannedUsers);
router.delete('/admin/user/:userId', authenticateToken, requireAdmin, adminController.deleteUser);

// ==================== ARTIST MANAGEMENT ====================
router.post('/admin/artist/ban', authenticateToken, requireAdmin, adminController.banArtist);
router.delete('/admin/artist/ban/:artistId', authenticateToken, requireAdmin, adminController.unbanArtist);
router.get('/admin/artist/banned', authenticateToken, requireAdmin, adminController.getBannedArtists);

// ==================== ALBUM MANAGEMENT ====================
router.patch('/admin/album/:albumId', authenticateToken, requireAdmin, adminController.renameAlbum);
router.delete('/admin/album/:albumId', authenticateToken, requireAdmin, adminController.deleteAlbum);

// ==================== TRACK MANAGEMENT ====================
router.patch('/admin/track/:trackId', authenticateToken, requireAdmin, adminController.renameTrack);
router.delete('/admin/track/:trackId', authenticateToken, requireAdmin, adminController.deleteTrack);

// ==================== REPORT MANAGEMENT ====================
router.get('/admin/reports', authenticateToken, requireAdmin, adminController.getReports);
router.patch('/admin/report/:reportId', authenticateToken, requireAdmin, adminController.updateReportStatus);

module.exports = router;
