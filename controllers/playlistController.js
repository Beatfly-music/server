const pool = require('../utils/db');

exports.createPlaylist = async (req, res) => {
  try {
    const { name, description, trackIds } = req.body;
    if (!name) return res.status(400).json({ error: "Playlist name is required." });
    // Insert into playlists.
    const [result] = await pool.query(
      `INSERT INTO playlists (name, description, user_id) VALUES (?, ?, ?)`,
      [name, description || '', req.user.id]
    );
    const playlistId = result.insertId;
    
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
    const [playlists] = await pool.query('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, req.user.id]);
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
    const [playlists] = await pool.query('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, req.user.id]);
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
    const [playlists] = await pool.query('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, req.user.id]);
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
    const [playlists] = await pool.query('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, req.user.id]);
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

    // Get all tracks in this playlist
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