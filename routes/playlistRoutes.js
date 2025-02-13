const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');
const authenticateToken = require('../middleware/auth');

// Create a new playlist.
router.post('/music/playlist.create', authenticateToken, playlistController.createPlaylist);

// Edit a playlist.
router.put('/music/playlist.edit/:playlistId', authenticateToken, playlistController.editPlaylist);

// Delete a playlist.
router.delete('/music/playlist.delete/:playlistId', authenticateToken, playlistController.deletePlaylist);

// Add a track to a playlist.
router.post('/music/playlist.addTrack', authenticateToken, playlistController.addTrackToPlaylist);

// Remove a track from a playlist.
router.delete('/music/playlist.removeTrack', authenticateToken, playlistController.removeTrackFromPlaylist);

// Get all playlists.
router.get('/music/playlists', authenticateToken, playlistController.getPlaylists);

//               Get a single playlist by ID.
router.get('/music/playlist/:playlistId', authenticateToken, playlistController.getPlaylist);

module.exports = router;
