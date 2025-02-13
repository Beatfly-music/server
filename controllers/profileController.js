const pool = require('../utils/db');
const path = require('path');

/**
 * Helper function to build a public image URL.
 * It removes the "uploads/" prefix from the stored file path and returns
 * a URL using the image route.
 *
 * For example, if filePath is:
 *   "uploads/albumArt/1739226278797-729899819-sample_album_art-cleaned.jpg"
 * It returns:
 *   "http://localhost:5000/xrpc/images/albumArt/1739226278797-729899819-sample_album_art-cleaned.jpg"
 */
function buildImageUrl(req, filePath) {
  if (!filePath) return "";
  // Remove any leading "uploads/" or "uploads\"
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

    // Convert the profile_pic to a public URL if available.
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
 * Returns an artist's profile including their public profile picture, associated albums, and tracks.
 */
exports.getArtistProfile = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Fetch the artist profile information.
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
    if (artistProfile.profile_pic) {
      artistProfile.profile_pic = buildImageUrl(req, artistProfile.profile_pic);
    }
    
    // Fetch albums with track counts.
    const [albumRows] = await pool.query(
      `SELECT a.id, a.title, a.artist, a.album_art, a.created_at,
              COUNT(t.id) as track_count,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', t.id,
                  'title', t.title,
                  'artist', t.artist,
                  'track_image', t.track_image,
                  'file_path', t.file_path,
                  'created_at', t.created_at,
                  'album_id', t.album_id
                )
              ) as tracks
       FROM albums a
       LEFT JOIN tracks t ON a.id = t.album_id
       WHERE a.user_id = ?
       GROUP BY a.id`,
      [user_id]
    );

    // Process each album and convert image paths to URLs.
    const albums = albumRows.map(album => {
      if (album.album_art) {
        album.album_art = buildImageUrl(req, album.album_art);
      }
      let tracks = [];
      try {
        tracks = JSON.parse(album.tracks);
      } catch (err) {
        tracks = [];
      }
      // If the first track has a null id, reset to an empty array.
      if (tracks.length > 0 && tracks[0].id === null) {
        tracks = [];
      } else {
        tracks = tracks.map(track => ({
          ...track,
          track_image: track.track_image ? buildImageUrl(req, track.track_image) : null
        }));
      }
      return {
        id: album.id,
        title: album.title,
        artist: album.artist,
        album_art: album.album_art,
        created_at: album.created_at,
        track_count: album.track_count,
        tracks
      };
    });

    artistProfile.albums = albums;
    
    // Fetch standalone tracks by this artist (tracks not associated with an album).
    const [trackRows] = await pool.query(
      `SELECT id, title, artist, track_image, created_at, album_id, file_path
       FROM tracks 
       WHERE artist = (SELECT username FROM users WHERE id = ?) 
       AND album_id IS NULL`,
      [user_id]
    );

    const tracks = trackRows.map(track => ({
      ...track,
      track_image: track.track_image ? buildImageUrl(req, track.track_image) : null
    }));

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

