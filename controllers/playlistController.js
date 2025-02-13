const pool = require('../utils/db');

/**
 * Helper function to generate a random 10-digit playlist ID
 * that is unique within the playlists table.
 */
const generateUniquePlaylistId = async () => {
  let unique = false;
  let id;
  while (!unique) {
    // Generate a random 10-digit number.
    id = Math.floor(100000 + Math.random() * 90000);
    const [rows] = await pool.query('SELECT id FROM playlists WHERE id = ?', [id]);
    if (rows.length === 0) {
      unique = true;
    }
  }
  return id;
};

exports.createPlaylist = async (req, res) => {
  try {
    const { name, description, trackIds } = req.body;
    if (!name) return res.status(400).json({ error: "Playlist name is required." });
    
    // Generate a unique playlist ID.
    const playlistId = await generateUniquePlaylistId();
    
    // Insert into playlists with the custom playlistId.
    await pool.query(
      `INSERT INTO playlists (id, name, description, user_id) VALUES (?, ?, ?, ?)`,
      [playlistId, name, description || '', req.user.id]
    );
    
    // Only insert into playlist_tracks if trackIds is provided and non-empty.
    if (trackIds && Array.isArray(trackIds) && trackIds.length > 0) {
      const values = trackIds.map((trackId) => [playlistId, trackId]);
      await pool.query(
        `INSERT INTO playlist_tracks (playlist_id, track_id) VALUES ?`,
        [values]
      );
    }
    res.status(201).json({ message: "Playlist created successfully", playlistId });
  } catch (error) {
    console.error("Create playlist error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.editPlaylist = async (req, res) => {
  try {
    const playlistId = req.params.playlistId;
    const { name, description } = req.body;
    const [playlists] = await pool.query(
      'SELECT * FROM playlists WHERE id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (playlists.length === 0)
      return res.status(404).json({ error: "Playlist not found or not owned by you." });
    await pool.query(
      'UPDATE playlists SET name = ?, description = ? WHERE id = ?',
      [name || playlists[0].name, description || playlists[0].description, playlistId]
    );
    res.json({ message: "Playlist updated successfully" });
  } catch (error) {
    console.error("Edit playlist error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deletePlaylist = async (req, res) => {
  try {
    const playlistId = req.params.playlistId;
    const [playlists] = await pool.query(
      'SELECT * FROM playlists WHERE id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (playlists.length === 0)
      return res.status(404).json({ error: "Playlist not found or not owned by you." });
    await pool.query('DELETE FROM playlists WHERE id = ?', [playlistId]);
    res.json({ message: "Playlist deleted successfully" });
  } catch (error) {
    console.error("Delete playlist error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.addTrackToPlaylist = async (req, res) => {
  try {
    const { playlistId, trackId } = req.body;
    const [playlists] = await pool.query(
      'SELECT * FROM playlists WHERE id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (playlists.length === 0)
      return res.status(404).json({ error: "Playlist not found or not owned by you." });
    await pool.query(
      'INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)',
      [playlistId, trackId]
    );
    res.json({ message: "Track added to playlist" });
  } catch (error) {
    console.error("Add track error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.removeTrackFromPlaylist = async (req, res) => {
  try {
    const { playlistId, trackId } = req.body;
    const [playlists] = await pool.query(
      'SELECT * FROM playlists WHERE id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (playlists.length === 0)
      return res.status(404).json({ error: "Playlist not found or not owned by you." });
    await pool.query(
      'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
      [playlistId, trackId]
    );
    res.json({ message: "Track removed from playlist" });
  } catch (error) {
    console.error("Remove track error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getPlaylists = async (req, res) => {
  try {
    const [playlists] = await pool.query('SELECT * FROM playlists WHERE user_id = ?', [req.user.id]);
    res.json({ playlists });
  } catch (error) {
    console.error("Get playlists error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get a single playlist with its tracks.
exports.getPlaylist = async (req, res) => {
  try {
    const playlistId = req.params.playlistId;
    // Get the playlist details (you may want to remove user_id check if playlists are public)
    const [playlists] = await pool.query(
      'SELECT * FROM playlists WHERE id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (playlists.length === 0) {
      return res.status(404).json({ error: "Playlist not found or not owned by you." });
    }
    const playlist = playlists[0];

    // Get all tracks in this playlist.
    const [tracks] = await pool.query(
      `SELECT t.* 
       FROM playlist_tracks pt 
       JOIN tracks t ON pt.track_id = t.id 
       WHERE pt.playlist_id = ?`,
      [playlistId]
    );
    playlist.tracks = tracks;
    res.json(playlist);
  } catch (error) {
    console.error("Get playlist error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
