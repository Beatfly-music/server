const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/auth');

router.get('/user.yearinreview', authenticateToken, userController.getYearInReview);

router.get('/user.settings', authenticateToken, userController.getSettings);
router.patch('/user.settings', authenticateToken, userController.updateSettings);

router.post('/user.dislike.track', authenticateToken, userController.dislikeTrack);
router.delete('/user.dislike.track/:trackId', authenticateToken, userController.removeDislike);
router.get('/user.dislike.tracks', authenticateToken, userController.getDislikedTracks);

router.post('/user.block.artist', authenticateToken, userController.blockArtist);
router.delete('/user.block.artist/:artistId', authenticateToken, userController.unblockArtist);
router.get('/user.blocked.artists', authenticateToken, userController.getBlockedArtists);

router.get('/user.playback.state', authenticateToken, userController.getPlaybackState);
router.post('/user.playback.state', authenticateToken, userController.savePlaybackState);

module.exports = router;
