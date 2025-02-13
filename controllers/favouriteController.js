// controllers/favouriteController.js
const pool = require('../utils/db');

// Helper function for checking if record exists
const checkExists = async (table, id) => {
  const [rows] = await pool.query(`SELECT id FROM ${table} WHERE id = ?`, [id]);
  return rows.length > 0;
};

// Helper function for checking if favorite exists
const checkFavoriteExists = async (table, userId, itemId, itemType) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${table} WHERE user_id = ? AND ${itemType}_id = ?`,
    [userId, itemId]
  );
  return rows.length > 0;
};

const favouriteController = {
  // Album favorites
  favouriteAlbum: async (req, res) => {
    try {
      const { albumId } = req.body;
      const userId = req.user.id;

      if (!albumId) {
        return res.status(400).json({ error: "Album ID required" });
      }

      // Check if album exists
      const albumExists = await checkExists('albums', albumId);
      if (!albumExists) {
        return res.status(404).json({ error: "Album not found" });
      }

      // Check if already favorited
      const isFavorited = await checkFavoriteExists('favourite_albums', userId, albumId, 'album');
      if (isFavorited) {
        return res.status(200).json({
          message: "Album already in favorites",
          alreadyFavorited: true
        });
      }

      // Add to favorites
      await pool.query(
        'INSERT INTO favourite_albums (user_id, album_id) VALUES (?, ?)',
        [userId, albumId]
      );

      res.status(201).json({
        message: "Album added to favorites",
        success: true
      });
    } catch (error) {
      console.error("Favourite album error:", error);
      res.status(500).json({ error: "Failed to favorite album" });
    }
  },

  unfavouriteAlbum: async (req, res) => {
    try {
      const { albumId } = req.params;
      const userId = req.user.id;

      const [result] = await pool.query(
        'DELETE FROM favourite_albums WHERE user_id = ? AND album_id = ?',
        [userId, albumId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Album not found in favorites" });
      }

      res.status(200).json({
        message: "Album removed from favorites",
        success: true
      });
    } catch (error) {
      console.error("Unfavourite album error:", error);
      res.status(500).json({ error: "Failed to unfavorite album" });
    }
  },

  // GET favorite albums
  getFavoriteAlbums: async (req, res) => {
    try {
      const userId = req.user.id;

      const [albums] = await pool.query(`
        SELECT 
          a.*
        FROM albums a
        INNER JOIN favourite_albums fa ON a.id = fa.album_id
        WHERE fa.user_id = ?
        ORDER BY a.created_at DESC
      `, [userId]);

      res.status(200).json({ albums });
    } catch (error) {
      console.error("Get favorite albums error:", error);
      res.status(500).json({ error: "Failed to get favorite albums" });
    }
  },

  // Track favorites
  favouriteTrack: async (req, res) => {
    try {
      const { trackId } = req.body;
      const userId = req.user.id;

      if (!trackId) {
        return res.status(400).json({ error: "Track ID required" });
      }

      // Check if track exists
      const trackExists = await checkExists('tracks', trackId);
      if (!trackExists) {
        return res.status(404).json({ error: "Track not found" });
      }

      // Check if already favorited
      const isFavorited = await checkFavoriteExists('favourite_tracks', userId, trackId, 'track');
      if (isFavorited) {
        return res.status(200).json({
          message: "Track already in favorites",
          alreadyFavorited: true
        });
      }

      // Add to favorites
      await pool.query(
        'INSERT INTO favourite_tracks (user_id, track_id) VALUES (?, ?)',
        [userId, trackId]
      );

      res.status(201).json({
        message: "Track added to favorites",
        success: true
      });
    } catch (error) {
      console.error("Favourite track error:", error);
      res.status(500).json({ error: "Failed to favorite track" });
    }
  },

  unfavouriteTrack: async (req, res) => {
    try {
      const { trackId } = req.params;
      const userId = req.user.id;

      const [result] = await pool.query(
        'DELETE FROM favourite_tracks WHERE user_id = ? AND track_id = ?',
        [userId, trackId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Track not found in favorites" });
      }

      res.status(200).json({
        message: "Track removed from favorites",
        success: true
      });
    } catch (error) {
      console.error("Unfavourite track error:", error);
      res.status(500).json({ error: "Failed to unfavorite track" });
    }
  },

  checkFavoriteStatus: async (req, res) => {
    try {
      const { trackId } = req.params;
      const userId = req.user.id;

      const isFavorited = await checkFavoriteExists('favourite_tracks', userId, trackId, 'track');

      res.status(200).json({ isFavorited });
    } catch (error) {
      console.error("Check favorite status error:", error);
      res.status(500).json({ error: "Failed to check favorite status" });
    }
  },

  // GET favorite tracks – note that we've removed the non-existent ft.created_at field
  getFavoriteTracks: async (req, res) => {
    try {
      const userId = req.user.id;

      const [tracks] = await pool.query(`
        SELECT 
          t.*,
          a.title as album_title,
          a.album_art
        FROM tracks t
        INNER JOIN favourite_tracks ft ON t.id = ft.track_id
        LEFT JOIN albums a ON t.album_id = a.id
        WHERE ft.user_id = ?
        ORDER BY t.created_at DESC
      `, [userId]);

      res.status(200).json({
        tracks: tracks.map(track => ({
          ...track,
          track_image: track.track_image || track.album_art
        }))
      });
    } catch (error) {
      console.error("Get favorite tracks error:", error);
      res.status(500).json({ error: "Failed to get favorite tracks" });
    }
  },

  // Artist favorites
  favouriteArtist: async (req, res) => {
    try {
      const { artistId } = req.body;
      const userId = req.user.id;

      if (!artistId) {
        return res.status(400).json({ error: "Artist ID required" });
      }

      // Check if artist exists
      const artistExists = await checkExists('artists', artistId);
      if (!artistExists) {
        return res.status(404).json({ error: "Artist not found" });
      }

      // Check if already favorited
      const isFavorited = await checkFavoriteExists('favourite_artists', userId, artistId, 'artist');
      if (isFavorited) {
        return res.status(200).json({
          message: "Artist already in favorites",
          alreadyFavorited: true
        });
      }

      // Add to favorites
      await pool.query(
        'INSERT INTO favourite_artists (user_id, artist_id) VALUES (?, ?)',
        [userId, artistId]
      );

      res.status(201).json({
        message: "Artist added to favorites",
        success: true
      });
    } catch (error) {
      console.error("Favourite artist error:", error);
      res.status(500).json({ error: "Failed to favorite artist" });
    }
  },

  unfavouriteArtist: async (req, res) => {
    try {
      const { artistId } = req.params;
      const userId = req.user.id;

      const [result] = await pool.query(
        'DELETE FROM favourite_artists WHERE user_id = ? AND artist_id = ?',
        [userId, artistId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Artist not found in favorites" });
      }

      res.status(200).json({
        message: "Artist removed from favorites",
        success: true
      });
    } catch (error) { 
      console.error("Unfavourite artist error:", error);
      res.status(500).json({ error: "Failed to unfavorite artist" });
    }
  }
};

module.exports = favouriteController;
