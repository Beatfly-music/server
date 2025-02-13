// controllers/searchController.js
const pool = require('../utils/db');

exports.search = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required." });
    }
    const searchQuery = `%${q}%`;

    // Search in users: return id, username, and profile_pic.
    const [users] = await pool.query(
      `SELECT u.id, u.username, IFNULL(up.profile_pic, '') AS profile_pic
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.username LIKE ? OR SOUNDEX(u.username) = SOUNDEX(?)
       LIMIT 10`,
      [searchQuery, q]
    );

    // Search in albums: return id, title, artist, and album_art.
    const [albums] = await pool.query(
      `SELECT id, title, artist, album_art 
       FROM albums 
       WHERE title LIKE ? OR artist LIKE ? 
         OR SOUNDEX(title) = SOUNDEX(?) OR SOUNDEX(artist) = SOUNDEX(?)
       LIMIT 10`,
      [searchQuery, searchQuery, q, q]
    );

    // Search in tracks: return id, title, artist, and track_image.
    const [tracks] = await pool.query(
      `SELECT id, title, artist, track_image 
       FROM tracks 
       WHERE title LIKE ? OR artist LIKE ? 
         OR SOUNDEX(title) = SOUNDEX(?) OR SOUNDEX(artist) = SOUNDEX(?)
       LIMIT 10`,
      [searchQuery, searchQuery, q, q]
    );

    res.json({ users, albums, tracks });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
