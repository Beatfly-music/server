// routes/favouriteRoutes.js
const express = require('express');
const router = express.Router();
const favouriteController = require('../controllers/favouriteController');
const authenticateToken = require('../middleware/auth');

// Album favorites
router.post('/music/favourite.album',
  authenticateToken,
  favouriteController.favouriteAlbum
);

router.delete('/music/favourite.album/:albumId',
  authenticateToken,
  favouriteController.unfavouriteAlbum
);

// GET favorite albums
router.get('/music/favourite.albums',
  authenticateToken,
  favouriteController.getFavoriteAlbums
);

// Track favorites
router.post('/music/favourite.track',
  authenticateToken,
  favouriteController.favouriteTrack
);

router.delete('/music/favourite.track/:trackId',
  authenticateToken,
  favouriteController.unfavouriteTrack
);

router.get('/music/favourite.track/status/:trackId',
  authenticateToken,
  favouriteController.checkFavoriteStatus
);

// GET favorite tracks – updated to remove reference to ft.created_at
router.get('/music/favourite.tracks',
  authenticateToken,
  favouriteController.getFavoriteTracks
);

// Artist favorites
router.post('/music/favourite.artist',
  authenticateToken,
  favouriteController.favouriteArtist
);

router.delete('/music/favourite.artist/:artistId',
  authenticateToken,
  favouriteController.unfavouriteArtist
);

module.exports = router;
  