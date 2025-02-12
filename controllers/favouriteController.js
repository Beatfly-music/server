// controllers/favouriteController.js
const pool = require('../utils/db');

exports.favouriteAlbum = async (req, res) => {
  try {
    const { albumId } = req.body;
    if (!albumId) return res.status(400).json({ error: "Album ID required" });
    await pool.query('INSERT INTO favourite_albums (user_id, album_id) VALUES (?, ?)', [req.user.id, albumId]);
    res.status(201).json({ message: "Album favourited" });
  } catch (error) {
    console.error("Favourite album error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.unfavouriteAlbum = async (req, res) => {
  try {
    const albumId = req.params.albumId;
    await pool.query('DELETE FROM favourite_albums WHERE user_id = ? AND album_id = ?', [req.user.id, albumId]);
    res.json({ message: "Album unfavourited" });
  } catch (error) {
    console.error("Unfavourite album error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.favouriteTrack = async (req, res) => {
  try {
    const { trackId } = req.body;
    if (!trackId) return res.status(400).json({ error: "Track ID required" });
    await pool.query('INSERT INTO favourite_tracks (user_id, track_id) VALUES (?, ?)', [req.user.id, trackId]);
    res.status(201).json({ message: "Track favourited" });
  } catch (error) {
    console.error("Favourite track error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.unfavouriteTrack = async (req, res) => {
  try {
    const trackId = req.params.trackId;
    await pool.query('DELETE FROM favourite_tracks WHERE user_id = ? AND track_id = ?', [req.user.id, trackId]);
    res.json({ message: "Track unfavourited" });
  } catch (error) {
    console.error("Unfavourite track error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// NEW: Favourite artist endpoints
exports.favouriteArtist = async (req, res) => {
  try {
    const { artistId } = req.body;
    if (!artistId) return res.status(400).json({ error: "Artist ID required" });
    await pool.query('INSERT INTO favourite_artists (user_id, artist_id) VALUES (?, ?)', [req.user.id, artistId]);
    res.status(201).json({ message: "Artist favourited" });
  } catch (error) {
    console.error("Favourite artist error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.unfavouriteArtist = async (req, res) => {
  try {
    const artistId = req.params.artistId;
    await pool.query('DELETE FROM favourite_artists WHERE user_id = ? AND artist_id = ?', [req.user.id, artistId]);
    res.json({ message: "Artist unfavourited" });
  } catch (error) {
    console.error("Unfavourite artist error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
