const express = require('express');
const router = express.Router();
const favouriteController = require('../controllers/favouriteController');
const authenticateToken = require('../middleware/auth');

router.post('/music/favourite.album', authenticateToken, favouriteController.favouriteAlbum);
router.delete('/music/favourite.album/:albumId', authenticateToken, favouriteController.unfavouriteAlbum);
router.post('/music/favourite.track', authenticateToken, favouriteController.favouriteTrack);
router.delete('/music/favourite.track/:trackId', authenticateToken, favouriteController.unfavouriteTrack);

// NEW endpoints for artist favourites:
router.post('/music/favourite.artist', authenticateToken, favouriteController.favouriteArtist);
router.delete('/music/favourite.artist/:artistId', authenticateToken, favouriteController.unfavouriteArtist);

module.exports = router;
