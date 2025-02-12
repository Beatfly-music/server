const pool = require('../utils/db');

/**
 * Helper function that converts a local file path (stored in the database)
 * into a public URL using the image route.
 * 
 * For example, if filePath is:
 *    "uploads/albumArt/1739226278797-729899819-sample_album_art-cleaned.jpg"
 * It returns:
 *    "http://localhost:5000/xrpc/images/albumArt/1739226278797-729899819-sample_album_art-cleaned.jpg"
 */
function buildImageUrl(req, filePath) {
  if (!filePath) return "";
  // Remove any leading "uploads/" or "uploads\" and return a URL.
  const relative = filePath.replace(/^uploads[\/\\]/, '');
  return `${req.protocol}://${req.get('host')}/xrpc/images/${relative}`;
}

/**
 * GET /xrpc/profile.get
 * Returns the authenticated user's profile.
 */
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.created_at, p.biography, p.profile_pic 
       FROM users u 
       LEFT JOIN user_profiles p ON u.id = p.user_id 
       WHERE u.id = ?`,
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Profile not found" });
    const profile = rows[0];
    // Convert the profile_pic to a public URL.
    if (profile.profile_pic) {
      profile.profile_pic = buildImageUrl(req, profile.profile_pic);
    }
    res.json(profile);
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /xrpc/profile.update
 * Updates the authenticated user's profile.
 */
exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { biography } = req.body;
    let profilePic = null;
    if (req.file) {
      profilePic = req.file.path;
    }
    await pool.query(
      `INSERT INTO user_profiles (user_id, biography, profile_pic) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE biography = VALUES(biography), profile_pic = VALUES(profile_pic)`,
      [userId, biography, profilePic]
    );
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /xrpc/artist.getProfile?user_id=...
 * Returns an artist's profile, including a public profile picture, and
 * also fetches associated albums and tracks.
 */
exports.getArtistProfile = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }
    // Fetch the artist profile information (joined with user_profiles and users).
    const [rows] = await pool.query(
      `SELECT ap.*, up.profile_pic, u.username
       FROM artist_profiles ap 
       LEFT JOIN user_profiles up ON ap.user_id = up.user_id 
       LEFT JOIN users u ON ap.user_id = u.id 
       WHERE ap.user_id = ?`,
      [user_id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Artist profile not found" });
    }
    const artistProfile = rows[0];
    // Convert profile_pic URL.
    if (artistProfile.profile_pic) {
      artistProfile.profile_pic = buildImageUrl(req, artistProfile.profile_pic);
    }
    
    // Fetch albums created by this artist.
    const [albumRows] = await pool.query(
      "SELECT id, title, artist, album_art FROM albums WHERE user_id = ?",
      [user_id]
    );
    // Convert album_art URLs.
    const albums = albumRows.map(album => {
      if (album.album_art) {
        album.album_art = buildImageUrl(req, album.album_art);
      }
      return album;
    });
    artistProfile.albums = albums;
    
    // Fetch tracks by this artist.
    // (Assuming tracks are associated by matching the artist field to the user's username.)
    const [trackRows] = await pool.query(
      "SELECT id, title, artist, track_image FROM tracks WHERE artist = (SELECT username FROM users WHERE id = ?)",
      [user_id]
    );
    const tracks = trackRows.map(track => {
      if (track.track_image) {
        track.track_image = buildImageUrl(req, track.track_image);
      }
      return track;
    });
    artistProfile.tracks = tracks;
    
    res.json(artistProfile);
  } catch (error) {
    console.error("Error fetching artist profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /xrpc/artist.updateProfile
 * Updates the authenticated user's artist profile.
 */
exports.updateArtistProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { stage_name, bio, promoted_album, promoted_track } = req.body;
    await pool.query(
      `INSERT INTO artist_profiles (user_id, stage_name, bio, promoted_album, promoted_track) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE stage_name = VALUES(stage_name), bio = VALUES(bio), 
                             promoted_album = VALUES(promoted_album), promoted_track = VALUES(promoted_track)`,
      [userId, stage_name, bio, promoted_album, promoted_track]
    );
    res.json({ message: "Artist profile updated successfully" });
  } catch (error) {
    console.error("Update artist profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
