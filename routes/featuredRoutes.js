const express = require('express');
const router = express.Router();
const featuredController = require('../controllers/featuredController');
// (Optionally, you can protect this route; here we assume it is public.)
router.get('/music.featuredAlbums', featuredController.getFeaturedAlbums);
module.exports = router;
